// Firestore data layer for Coffee Shaky.
//
// This is a module (the Firebase SDK is modular), but index.html's inline script
// is a classic script with onclick="..." handlers, so everything is exposed on
// window.CoffeeDB. Module scripts are deferred and run before DOMContentLoaded,
// so window.CoffeeDB is always ready by the time initializeApp() runs.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import {
    getFirestore,
    collection,
    doc,
    query,
    orderBy,
    onSnapshot,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const COLLECTION = 'coffee_orders';
const ACTIVE_STATUSES = ['preparing', 'ready'];
const BATCH_LIMIT = 400; // Firestore allows 500 writes per batch; leave headroom.

let ordersRef = null;
let initError = null;

try {
    const config = window.COFFEE_SHAKY_FIREBASE_CONFIG || {};
    const missing = ['apiKey', 'projectId', 'appId'].filter(
        key => !config[key] || String(config[key]).includes('PASTE_')
    );

    if (missing.length) {
        throw new Error('firebase-config.js is missing: ' + missing.join(', '));
    }

    ordersRef = collection(getFirestore(initializeApp(config)), COLLECTION);
} catch (error) {
    initError = error;
}

function requireReady() {
    if (initError) {
        throw initError;
    }
}

// Firestore documents come back with string ids and Timestamp values. Normalize
// them into the shape the rest of the app already expects.
function toOrder(docSnap) {
    // 'estimate' gives a local guess for created_at on our own just-written
    // orders, which are visible before the server timestamp lands.
    const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
    const createdAt = data.created_at && typeof data.created_at.toDate === 'function'
        ? data.created_at.toDate()
        : new Date();

    return {
        id: docSnap.id,
        product_name: data.product_name || '',
        customer_name: data.customer_name || '',
        special_request: data.special_request || '',
        status: ACTIVE_STATUSES.includes(data.status) ? data.status : 'preparing',
        created_at: createdAt
    };
}

// One live listener replaces the old load + subscribe + manual-patch + reconnect
// cycle: every change re-delivers the full ordered list, and the SDK reconnects
// on its own. Returns an unsubscribe function.
function subscribeToOrders(onOrders, onConnectionChange) {
    requireReady();

    // No status filter in the query: only 'preparing' and 'ready' are ever
    // stored, and filtering client-side avoids needing a composite index.
    return onSnapshot(
        query(ordersRef, orderBy('created_at', 'desc')),
        snapshot => {
            const orders = snapshot.docs
                .map(toOrder)
                .filter(order => ACTIVE_STATUSES.includes(order.status));

            onOrders(orders);

            if (onConnectionChange) {
                // fromCache means we are serving local data while offline.
                onConnectionChange(!snapshot.metadata.fromCache, null);
            }
        },
        error => {
            if (onConnectionChange) {
                onConnectionChange(false, error);
            }
        }
    );
}

async function createOrder({ productName, customerName, specialRequest }) {
    requireReady();

    const product = (productName || '').trim();
    const customer = (customerName || '').trim();

    if (!product || !customer) {
        throw new Error('חסר שם לקוח או משקה');
    }

    const created = await addDoc(ordersRef, {
        product_name: product,
        customer_name: customer,
        special_request: (specialRequest || '').trim(),
        status: 'preparing',
        created_at: serverTimestamp()
    });

    return created.id;
}

async function updateOrderStatus(orderId, status) {
    requireReady();

    if (!ACTIVE_STATUSES.includes(status)) {
        throw new Error('סטטוס לא חוקי: ' + status);
    }

    await updateDoc(doc(ordersRef, orderId), { status });
}

async function removeOrder(orderId) {
    requireReady();
    await deleteDoc(doc(ordersRef, orderId));
}

// Firestore has no "delete where", so read the ids and batch the deletes.
async function removeAllOrders() {
    requireReady();

    const snapshot = await getDocs(ordersRef);
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(ordersRef.firestore);
        docs.slice(i, i + BATCH_LIMIT).forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
    }

    return docs.length;
}

window.CoffeeDB = {
    initError,
    subscribeToOrders,
    createOrder,
    updateOrderStatus,
    removeOrder,
    removeAllOrders
};
