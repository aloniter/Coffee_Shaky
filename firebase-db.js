// Firestore data layer for Coffee Shaky.
//
// This is a module (the Firebase SDK is modular), but index.html's inline script
// is a classic script with onclick="..." handlers, so everything is exposed on
// window.CoffeeDB. Module scripts are deferred and run before DOMContentLoaded,
// so window.CoffeeDB is always ready by the time initializeApp() runs.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    collection,
    doc,
    query,
    orderBy,
    onSnapshot,
    setDoc,
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

    // Persistent cache: an order sent with no connection is kept in IndexedDB,
    // so it still reaches the kitchen after the app is closed or reloaded.
    const db = initializeFirestore(initializeApp(config), {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    ordersRef = collection(db, COLLECTION);
} catch (error) {
    initError = error;
}

// When IndexedDB is unavailable Firestore quietly falls back to a memory cache,
// and then a queued order dies with the app. Check for ourselves so the app
// only promises "saved on this phone" when that is true.
let persistentCache = false;

try {
    const probe = indexedDB.open('coffee-shaky-probe');
    probe.onsuccess = () => {
        probe.result.close();
        persistentCache = true;
    };
} catch (error) {
    persistentCache = false;
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
        created_at: createdAt,
        // A change made on this device that the server has not confirmed yet.
        pending: docSnap.metadata.hasPendingWrites
    };
}

// One live listener: every change re-delivers the full list, oldest first, and
// the SDK reconnects on its own. Metadata changes are included so that going
// offline, coming back, and a write being confirmed all reach the UI even when
// no order changed. Returns an unsubscribe function.
function subscribeToOrders(onOrders, onConnectionChange) {
    requireReady();

    // No status filter in the query: only 'preparing' and 'ready' are ever
    // stored, and filtering client-side avoids needing a composite index.
    return onSnapshot(
        query(ordersRef, orderBy('created_at', 'asc')),
        { includeMetadataChanges: true },
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

// The id is made on the device before anything is sent, so the order has one
// identity from the first tap: the SDK retries it under that id, and the UI can
// follow it from "waiting for the network" to "in the kitchen".
function newOrderId() {
    requireReady();
    return doc(ordersRef).id;
}

// Resolves only once the server has the order. With no connection it stays
// pending while the SDK holds the write and sends it when the network returns.
async function createOrder({ id, productName, customerName, specialRequest }) {
    requireReady();

    const product = (productName || '').trim();
    const customer = (customerName || '').trim();

    if (!id) {
        throw new Error('חסר מזהה הזמנה');
    }
    if (!product || !customer) {
        throw new Error('חסר שם לקוח או משקה');
    }

    await setDoc(doc(ordersRef, id), {
        product_name: product,
        customer_name: customer,
        special_request: (specialRequest || '').trim(),
        status: 'preparing',
        created_at: serverTimestamp()
    });

    return id;
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

// Deletes exactly the orders the caller was looking at, so an order that
// lands while "clear" is being confirmed survives. Works offline too: the
// batch is queued like any other write.
async function removeOrders(orderIds) {
    requireReady();

    for (let i = 0; i < orderIds.length; i += BATCH_LIMIT) {
        const batch = writeBatch(ordersRef.firestore);
        orderIds.slice(i, i + BATCH_LIMIT).forEach(id => batch.delete(doc(ordersRef, id)));
        await batch.commit();
    }

    return orderIds.length;
}

window.CoffeeDB = {
    initError,
    hasPersistentCache: () => persistentCache,
    subscribeToOrders,
    newOrderId,
    createOrder,
    updateOrderStatus,
    removeOrder,
    removeOrders
};
