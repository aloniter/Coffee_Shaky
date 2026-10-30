const PRODUCT_ICONS = {"הפוך הבית": "./assets/drinks/house.webp", "אספרסו": "./assets/drinks/espresso.webp", "שקדיאטו": "./assets/drinks/macchiato.webp", "אמריקנו": "./assets/drinks/americano.webp", "פלאט וויט": "./assets/drinks/flatwhite.webp", "לאטה": "./assets/drinks/latte.webp", "תה": "./assets/drinks/tea.webp", "אחר": "./assets/drinks/other.webp"};

        function debugLog(message, data = null) {
            console.log(`[Coffee Shaky] ${message}`, data ?? '');
        }

        let orders = [];
        let selectedProduct = null;
        let selectedIcon = null;
        let unsubscribeOrders = null;

        const MEOW_SOUND_FILE = 'מיאו.wav';

        let catMeowAudio = null;
        let pumaResetTimeout = null;
        let orderCelebrationTimeout = null;

        // Realtime bookkeeping: Firestore re-delivers the whole list on every
        // change, so remember what we have already shown to tell a genuinely
        // new ticket apart from a re-render, and to catch preparing -> ready.
        const seenOrderIds = new Set();
        const knownStatuses = new Map();
        let firstRenderDone = false;

        // Connection, from Firestore metadata so it is right even on an idle
        // screen: "warming" until the first server answer, then open or shut.
        let isConnected = false;
        let startupGrace = true;
        const STARTUP_GRACE_MS = 8000;

        // One order in flight at a time. If the server has not answered by
        // then, the order is handed to the offline queue and the form freed.
        let sendInFlight = false;
        const HANDOFF_ONLINE_MS = 4000;
        const HANDOFF_OFFLINE_MS = 700;

        // A change only shows as "waiting for the network" after this long,
        // so the normal ~100ms round trip never flashes a badge.
        const PENDING_VISIBLE_MS = 1500;
        const pendingSince = new Map();
        let pendingTimer = null;

        const EMPTY_LINES = [
            { title: 'התור ריק.', body: 'הבריסטה גולל ברשתות. זה הזמן לנצל את זה.' },
            { title: 'אף אחד לא רוצה קפה?', body: 'מצב חשוד. בדרך כלל יש כאן תור.' },
            { title: 'שקט תעשייתי במטבח.', body: 'המכונה חמה, החלב במקרר, קדימה.' }
        ];
        const emptyLine = EMPTY_LINES[Math.floor(Math.random() * EMPTY_LINES.length)];

        document.addEventListener('DOMContentLoaded', function () {
            initializeApp();
        });

        function initializeApp() {
            try {
                if (document.getElementById('orderForm')) {
                    setupMenuSelection();
                    setupOrderSheet();
                    setupEmployeeOfTheMonth();
                    trackKeyboard();
                }
                setupConnectionStatus();
                renderOrders();

                // iOS only applies :active press styles when the page listens
                // for touches; without this taps show no pressed feedback.
                document.addEventListener('touchstart', () => {}, { passive: true });

                if (!window.CoffeeDB) {
                    throw new Error('firebase-db.js did not load');
                }
                if (window.CoffeeDB.initError) {
                    throw window.CoffeeDB.initError;
                }

                startOrdersStream();
                debugLog('ready');
            } catch (error) {
                debugLog('init failed', error);
                showToast('המכונה לא מתניעה: ' + error.message, 'bad', 7000);
                startupGrace = false;
                updateConnectionStatus(false);
            }
        }

        /* ---------------- drink picking ---------------- */

        function setupMenuSelection() {
            document.querySelectorAll('.drink').forEach(item => {
                // The name lives in an <h3> next to an alt="" illustration, so
                // label the button itself rather than relying on subtree text.
                item.setAttribute('aria-label', item.dataset.product);
                item.setAttribute('aria-pressed', 'false');

                item.addEventListener('click', () => pickDrink(item));
            });
        }

        function pickDrink(card) {
            const product = card.dataset.product;
            const icon = card.dataset.icon;
            selectedProduct = product;
            selectedIcon = icon;

            document.querySelectorAll('.drink').forEach(el => {
                const isPicked = el.dataset.product === product;
                el.classList.toggle('is-picked', isPicked);
                el.setAttribute('aria-pressed', isPicked ? 'true' : 'false');
            });

            document.getElementById('sheetIcon').src = icon;
            document.getElementById('sheetName').textContent = product;

            // "אחר" has no fixed recipe, so the note carries the whole order.
            const isOther = product === 'אחר';
            document.getElementById('specialRequest').setAttribute('aria-required', String(isOther));
            document.getElementById('noteHint').textContent = isOther ? '(חובה כאן)' : '(לא חייב)';
            document.getElementById('specialRequest').placeholder = isOther
                ? 'מה בדיוק להכין?'
                : 'חלב שקדים, בלי סוכר, בלי לשפוך';

            clearFieldError('nameField', 'nameError');
            clearFieldError('noteField', 'noteError');

            openSheet(card);

            document.dispatchEvent(new CustomEvent('coffee:select', { detail: { card } }));
        }

        function openSheet(card) {
            const sheet = document.getElementById('orderForm');
            sheet.inert = false;
            sheet.classList.add('is-up');
            document.getElementById('orderBackdrop').hidden = false;
            document.getElementById('sheetClose').focus({ preventScroll: true });
        }

        function closeSheet() {
            const sheet = document.getElementById('orderForm');
            if (sheet.contains(document.activeElement)) document.activeElement.blur();
            sheet.classList.remove('is-up');
            sheet.inert = true;
            document.getElementById('orderBackdrop').hidden = true;
            document.dispatchEvent(new Event('coffee:close'));
        }

        // iOS pins fixed elements to the layout viewport, part of which the
        // keyboard covers. Lift the sheet by exactly that much.
        function trackKeyboard() {
            const viewport = window.visualViewport;
            if (!viewport) return;

            const sheet = document.getElementById('orderForm');
            const update = () => {
                const covered = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
                sheet.style.setProperty('--kb', covered + 'px');
                sheet.style.setProperty('--viewport-height', viewport.height + 'px');
                sheet.classList.toggle('has-kb', covered > 0);
            };

            viewport.addEventListener('resize', update);
            viewport.addEventListener('scroll', update);
        }

        function setupOrderSheet() {
            document.getElementById('orderForm').addEventListener('submit', event => {
                event.preventDefault();
                submitOrder();
            });

            // Closing means "not ordering", so the name goes too. To switch
            // drinks you just tap another one; the sheet stays up.
            document.getElementById('sheetClose').addEventListener('click', resetOrderForm);

            document.getElementById('customerName').addEventListener('input', () => {
                clearFieldError('nameField', 'nameError');
            });
            document.getElementById('specialRequest').addEventListener('input', () => {
                clearFieldError('noteField', 'noteError');
            });
        }

        /* ---------------- employee of the month ---------------- */

        function setupEmployeeOfTheMonth() {
            const employeeBanner = document.getElementById('employeeBanner');
            const employeeImage = document.getElementById('employeeImage');

            if (!employeeBanner || !employeeImage) return;

            // The polaroid frame is what jumps, so the photo, its border and
            // the tape travel together instead of the photo leaving the frame.
            const employeeFrame = employeeBanner.querySelector('.staff-frame');
            const originalEmployeeSrc = employeeImage.getAttribute('src');
            const originalEmployeeAlt = employeeImage.getAttribute('alt');
            let originalImageFailed = false;

            // Preload the puma photo so the click-time src swap comes from cache.
            // Without this it can still be in flight when the animation ends and
            // we swap back, which aborts the load and fires 'error' on the <img>.
            const pumaPreload = new Image();
            pumaPreload.src = 'puma.jpeg';

            // Only a broken original portrait should hide the photo. An aborted
            // puma load must never leave the element permanently invisible.
            employeeImage.addEventListener('error', () => {
                if (employeeImage.getAttribute('src') !== originalEmployeeSrc) return;
                originalImageFailed = true;
                employeeImage.style.visibility = 'hidden';
            });

            const restoreEmployeeImage = () => {
                employeeFrame.classList.remove('puma-jump');
                employeeImage.src = originalEmployeeSrc;
                employeeImage.alt = originalEmployeeAlt;
                employeeImage.style.visibility = originalImageFailed ? 'hidden' : '';
            };

            const triggerPumaJump = () => {
                if (pumaResetTimeout) {
                    clearTimeout(pumaResetTimeout);
                    pumaResetTimeout = null;
                }

                employeeImage.src = 'puma.jpeg';
                employeeImage.alt = 'פומה, עובד החודש בפועל';

                employeeFrame.classList.remove('puma-jump');
                employeeBanner.classList.remove('meowing');

                // Force reflow so the animation restarts on every tap.
                void employeeFrame.offsetWidth;

                employeeFrame.classList.add('puma-jump');
                employeeBanner.classList.add('meowing');
                playCatMeow();

                if (navigator.vibrate) navigator.vibrate(18);

                employeeFrame.addEventListener('animationend', () => {
                    restoreEmployeeImage();
                    if (pumaResetTimeout) {
                        clearTimeout(pumaResetTimeout);
                        pumaResetTimeout = null;
                    }
                }, { once: true });

                // Listen on the bubble itself: animationend bubbles, so a listener
                // on the button would also catch the frame's jump animation.
                const meowBubble = employeeBanner.querySelector('.meow-bubble');
                if (meowBubble) {
                    meowBubble.addEventListener('animationend', () => {
                        employeeBanner.classList.remove('meowing');
                    }, { once: true });
                }

                // Fallback in case animationend does not fire.
                pumaResetTimeout = setTimeout(() => {
                    restoreEmployeeImage();
                    employeeBanner.classList.remove('meowing');
                    pumaResetTimeout = null;
                }, 1150);
            };

            employeeBanner.addEventListener('click', triggerPumaJump);
        }

        function playCatMeow() {
            try {
                if (!catMeowAudio) {
                    catMeowAudio = new Audio(MEOW_SOUND_FILE);
                    catMeowAudio.preload = 'auto';
                }

                catMeowAudio.pause();
                catMeowAudio.currentTime = 0;
                const playPromise = catMeowAudio.play();

                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(error => {
                        debugLog('could not play the meow', error);
                        speakMeowFallback();
                    });
                }
            } catch (error) {
                debugLog('could not init the meow', error);
                speakMeowFallback();
            }
        }

        function speakMeowFallback() {
            if (!('speechSynthesis' in window)) return;

            const utterance = new SpeechSynthesisUtterance('מיאו');
            utterance.lang = 'he-IL';
            utterance.pitch = 1.8;
            utterance.rate = 0.95;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        }

        /* ---------------- realtime stream ---------------- */

        // Single live listener: Firestore re-delivers the whole ordered list on
        // every change and handles reconnection itself, so there is no separate
        // load step and no manual retry loop.
        function startOrdersStream() {
            if (unsubscribeOrders) {
                unsubscribeOrders();
            }

            unsubscribeOrders = window.CoffeeDB.subscribeToOrders(
                liveOrders => {
                    orders = liveOrders;
                    renderOrders();
                    document.dispatchEvent(new CustomEvent('coffee:feed', { detail: liveOrders }));
                },
                (connected, error) => {
                    updateConnectionStatus(connected);
                    if (error) {
                        debugLog('live orders error', error);
                        showToast('נפל החיבור למטבח: ' + error.message, 'bad', 6000);
                    }
                }
            );
        }

        function setupConnectionStatus() {
            renderConnection();

            // Past this, "still connecting" has become "no connection".
            setTimeout(() => {
                startupGrace = false;
                renderConnection();
            }, STARTUP_GRACE_MS);

            window.addEventListener('online', renderConnection);
            window.addEventListener('offline', renderConnection);
        }

        function updateConnectionStatus(connected) {
            const changed = connected !== isConnected;
            isConnected = connected;
            if (connected) startupGrace = false;

            renderConnection();
            // Offline, pending badges show at once instead of after a delay.
            if (changed) renderOrders();
        }

        function renderConnection() {
            const sign = document.getElementById('connectionStatus');
            const text = document.getElementById('connectionText');

            const state = isConnected ? 'open' : isOffline() ? 'shut' : 'warming';

            sign.classList.toggle('is-open', state === 'open');
            sign.classList.toggle('is-warming', state === 'warming');
            sign.classList.toggle('is-shut', state === 'shut');

            if (state === 'open') {
                text.textContent = 'פתוח · המכונה חמה';
            } else if (state === 'warming') {
                text.textContent = 'מדליקים את המכונה';
            } else {
                text.textContent = savesOffline() ? 'אין רשת · הזמנות יחכו בטלפון' : 'אין קשר עם המטבח';
            }
        }

        // Known to be offline, as opposed to still connecting after launch.
        function isOffline() {
            return !isConnected && !(startupGrace && navigator.onLine);
        }

        // True only when a queued order really survives closing the app.
        function savesOffline() {
            return Boolean(window.CoffeeDB && window.CoffeeDB.hasPersistentCache());
        }

        /* ---------------- ordering ---------------- */

        async function submitOrder() {
            if (sendInFlight) return;

            const nameInput = document.getElementById('customerName');
            const noteInput = document.getElementById('specialRequest');
            const submitBtn = document.getElementById('submitBtn');
            const submitLabel = document.getElementById('submitLabel');

            const customerName = nameInput.value.trim();
            const specialRequest = noteInput.value.trim();

            if (!selectedProduct) {
                showToast('קודם בוחרים משקה', 'bad');
                return;
            }

            if (!customerName) {
                setFieldError('nameField', 'nameError', 'בלי שם הקפה יתקרר על הדלפק.');
                nameInput.focus();
                return;
            }

            if (selectedProduct === 'אחר' && !specialRequest) {
                setFieldError('noteField', 'noteError', '"אחר" זה לא הזמנה. מה להכין?');
                noteInput.focus();
                return;
            }

            const orderedProduct = selectedProduct;

            // Same person, same drink, still waiting for the network: that is
            // a second tap on an order that already exists, not a new one.
            const alreadyWaiting = orders.some(order => order.pending
                && order.status === 'preparing'
                && order.product_name === orderedProduct
                && order.customer_name === customerName
                && order.special_request === specialRequest);

            if (alreadyWaiting) {
                resetOrderForm();
                showToast('ההזמנה הזו כבר בתור ומחכה לרשת', 'ok', 5000);
                return;
            }

            sendInFlight = true;
            submitBtn.disabled = true;
            submitLabel.textContent = 'רץ למטבח...';

            // No answer from the server in time. The order is already on this
            // phone and shows in the queue as waiting, so free the form for the
            // next person and say where the order actually is.
            let handedOff = false;
            const handoff = setTimeout(() => {
                handedOff = true;
                resetOrderForm();
                releaseSendButton();
                showToast(queuedMessage(), 'bad', 7000);
            }, isOffline() ? HANDOFF_OFFLINE_MS : HANDOFF_ONLINE_MS);

            try {
                // Resolves only once the server has the order.
                await window.CoffeeDB.createOrder({
                    id: window.CoffeeDB.newOrderId(),
                    productName: orderedProduct,
                    customerName: customerName,
                    specialRequest: specialRequest
                });

                clearTimeout(handoff);

                if (handedOff) {
                    showToast(`ההזמנה של ${customerName} הגיעה למטבח ✓`, 'ok');
                } else {
                    resetOrderForm();
                    showOrderCelebration(orderedProduct);
                }
            } catch (error) {
                clearTimeout(handoff);
                debugLog('order failed', error);
                showToast(`ההזמנה של ${customerName} לא עברה: ${error.message}`, 'bad', 6000);
            } finally {
                if (!handedOff) releaseSendButton();
            }
        }

        function queuedMessage() {
            const lead = isOffline() ? 'אין רשת.' : 'הרשת איטית.';
            return savesOffline()
                ? `${lead} ההזמנה שמורה בטלפון ותגיע למטבח לבד.`
                : `${lead} ההזמנה תגיע למטבח כשהרשת תחזור. אל תסגרו את האפליקציה עד אז.`;
        }

        function releaseSendButton() {
            sendInFlight = false;
            document.getElementById('submitBtn').disabled = false;
            document.getElementById('submitLabel').textContent = 'שלח לבריסטה';
        }

        // Keeps the typed name, so switching drinks mid-order does not make
        // you type it again. resetOrderForm() clears it once the order is sent.
        function cancelOrder() {
            closeSheet();
            document.getElementById('specialRequest').value = '';
            selectedProduct = null;
            selectedIcon = null;

            document.querySelectorAll('.drink').forEach(item => {
                item.classList.remove('is-picked');
                item.setAttribute('aria-pressed', 'false');
            });
        }

        // After an order goes out the next person starts from an empty name.
        function resetOrderForm() {
            cancelOrder();
            document.getElementById('customerName').value = '';
        }

        // Status changes show on their ticket as waiting until the server has
        // them. Deletes just vanish, so offline they get a word of their own.
        function noteIfOffline() {
            if (!isOffline()) return false;
            showToast('נמחק אצלך. אצל כולם זה יתעדכן כשהרשת תחזור.', 'bad', 5000);
            return true;
        }

        async function updateOrderStatus(orderId, newStatus) {
            try {
                await window.CoffeeDB.updateOrderStatus(orderId, newStatus);
            } catch (error) {
                debugLog('status update failed', error);
                showToast('לא הצלחתי לעדכן: ' + error.message, 'bad');
            }
        }

        async function completeOrder(orderId) {
            const offline = noteIfOffline();

            try {
                await window.CoffeeDB.removeOrder(orderId);
                if (!offline) showToast('בתיאבון', 'ok');
            } catch (error) {
                debugLog('complete failed', error);
                showToast('לא הצלחתי לסגור: ' + error.message, 'bad');
            }
        }

        async function deleteOrder(orderId) {
            const order = orders.find(item => item.id === orderId);
            if (!order) return;

            const confirmed = await askConfirm({
                icon: '',
                title: `לבטל את ההזמנה של ${order.customer_name}?`,
                body: `${order.product_name}. זה יימחק מהתור אצל כולם.`,
                yes: 'כן, לבטל',
                no: 'לא, שיישאר'
            });
            if (!confirmed) return;

            noteIfOffline();

            try {
                await window.CoffeeDB.removeOrder(orderId);
            } catch (error) {
                debugLog('delete failed', error);
                showToast('לא הצלחתי למחוק: ' + error.message, 'bad');
            }
        }

        async function clearAllOrders() {
            if (!orders.length) {
                showToast('התור כבר ריק', 'ok');
                return;
            }

            // Only what was on screen when asked: an order that lands while
            // the question is open survives.
            const orderIds = orders.map(order => order.id);

            const confirmed = await askConfirm({
                icon: '',
                title: 'לנקות את כל התור?',
                body: 'גם את מה שכבר מוכן. זה יימחק אצל כולם.',
                yes: 'כן, לנקות',
                no: 'לא, רגע'
            });
            if (!confirmed) return;

            const offline = noteIfOffline();

            try {
                await window.CoffeeDB.removeOrders(orderIds);
                if (!offline) showToast('הדלפק נוקה', 'ok');
            } catch (error) {
                debugLog('clear all failed', error);
                showToast('לא הצלחתי לנקות: ' + error.message, 'bad');
            }
        }

        // In-app replacement for window.confirm(). Resolves true or false.
        function askConfirm({ icon, title, body, yes, no }) {
            const scrim = document.getElementById('confirmScrim');
            const sheet = document.getElementById('confirmSheet');
            const yesBtn = document.getElementById('confirmYes');
            const noBtn = document.getElementById('confirmNo');

            document.getElementById('confirmIcon').textContent = icon;
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmBody').textContent = body;
            yesBtn.textContent = yes;
            noBtn.textContent = no;

            scrim.hidden = false;
            sheet.hidden = false;
            noBtn.focus({ preventScroll: true });

            return new Promise(resolve => {
                const onKey = event => {
                    if (event.key === 'Escape') finish(false);
                };

                const finish = answer => {
                    scrim.hidden = true;
                    sheet.hidden = true;
                    yesBtn.onclick = null;
                    noBtn.onclick = null;
                    scrim.onclick = null;
                    document.removeEventListener('keydown', onKey);
                    resolve(answer);
                };

                yesBtn.onclick = () => finish(true);
                noBtn.onclick = () => finish(false);
                scrim.onclick = () => finish(false);
                document.addEventListener('keydown', onKey);
            });
        }

        /* ---------------- queue rendering ---------------- */

        function renderOrders() {
            const container = document.getElementById('ordersContainer');
            const countEl = document.getElementById('queueCount');

            // The feed is oldest first, so whoever has waited longest is at
            // the top of "in the works". Ready keeps newest first.
            const preparing = orders.filter(order => order.status === 'preparing');
            const ready = orders.filter(order => order.status === 'ready').reverse();

            if (countEl) countEl.textContent = orders.length ? orders.length : '';
            const dockCount = document.getElementById('dockCount');
            if (dockCount) { dockCount.textContent = orders.length; dockCount.hidden = !orders.length; }
            document.dispatchEvent(new CustomEvent('coffee:orders', { detail: {
                total: orders.length, preparing: preparing.length, ready: ready.length
            } }));
            // The customer page subscribes for offline duplicate prevention and
            // the kitchen count, but contains no order-management UI.
            if (!container) return;
            markPending();

            if (!orders.length) {
                container.innerHTML = `
                    <div class="empty">
                        <svg class="empty-cup" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h12v9a6 6 0 0 1-12 0V5Zm12 2h2a3 3 0 0 1 0 6h-2M3 21h15"/></svg>
                        <h3>${escapeHtml(emptyLine.title)}</h3>
                        <p>${escapeHtml(emptyLine.body)}</p>
                    </div>
                `;
                knownStatuses.clear();
                pendingSince.clear();
                firstRenderDone = true;
                return;
            }

            // The barista's next job comes first; both groups retain FIFO evidence.
            const groups = [
                { key: 'preparing', label: 'בהכנה', list: preparing },
                { key: 'ready', label: 'מוכן לאיסוף', list: ready }
            ].filter(group => group.list.length);

            const justReady = [];

            const html = groups.map(group => `
                <div class="queue-group queue-group--${group.key}">
                    <div class="queue-label">${escapeHtml(group.label)} <span class="n">${group.list.length}</span></div>
                    <div class="tickets">
                        ${group.list.map(order => renderTicket(order, justReady)).join('')}
                    </div>
                </div>
            `).join('');

            container.innerHTML = `<div class="queue-columns">${html}</div>`;

            orders.forEach(order => {
                seenOrderIds.add(order.id);
                knownStatuses.set(order.id, order.status);
            });

            // Forget ids that left the queue so a re-used id can animate again.
            const liveIds = new Set(orders.map(order => order.id));
            [...knownStatuses.keys()].forEach(id => {
                if (!liveIds.has(id)) {
                    knownStatuses.delete(id);
                    seenOrderIds.delete(id);
                }
            });
            [...pendingSince.keys()].forEach(id => {
                if (!liveIds.has(id)) pendingSince.delete(id);
            });

            justReady.forEach(id => burstOnTicket(id));
            firstRenderDone = true;
        }

        // Sets order.showPending: waiting for the server long enough to say
        // so, or at all while offline. Schedules a re-render for the moment a
        // still-fresh change crosses that line.
        function markPending() {
            const now = Date.now();
            let nextReveal = Infinity;

            orders.forEach(order => {
                if (!order.pending) {
                    pendingSince.delete(order.id);
                    order.showPending = false;
                    return;
                }

                if (!pendingSince.has(order.id)) pendingSince.set(order.id, now);
                const revealAt = pendingSince.get(order.id) + PENDING_VISIBLE_MS;
                order.showPending = !isConnected || now >= revealAt;
                if (!order.showPending) nextReveal = Math.min(nextReveal, revealAt);
            });

            clearTimeout(pendingTimer);
            pendingTimer = nextReveal === Infinity
                ? null
                : setTimeout(renderOrders, nextReveal - now + 20);
        }

        function renderTicket(order, justReady) {
            const timeString = order.created_at.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const isReady = order.status === 'ready';
            const isNew = firstRenderDone && !seenOrderIds.has(order.id);
            const turnedReady = firstRenderDone && isReady && knownStatuses.get(order.id) === 'preparing';

            if (turnedReady) justReady.push(order.id);

            const classes = ['ticket'];
            if (isReady) classes.push('ticket--ready');
            if (isNew) classes.push('is-new');
            if (turnedReady) classes.push('just-ready');
            if (order.showPending) classes.push('is-pending');

            const safeId = escapeHtml(order.id);
            // Offline, a ticket drawn after the icon left the browser cache
            // cannot load it; the img hides itself rather than show a broken
            // image in the cup.
            const icon = iconForProduct(order.product_name);

            const action = isReady
                ? `<button class="act" type="button" onclick="completeOrder('${safeId}')">נאסף</button><button class="act act--undo" type="button" onclick="updateOrderStatus('${safeId}', 'preparing')">עדיין לא מוכן</button>`
                : `<button class="act act--go" type="button" onclick="updateOrderStatus('${safeId}', 'ready')">מוכן!</button>`;

            const steam = isReady ? '' : `
                <span class="steam" aria-hidden="true"></span>
                <span class="steam" aria-hidden="true"></span>
                <span class="steam" aria-hidden="true"></span>`;

            return `
                <article class="${classes.join(' ')}" data-order-id="${safeId}">
                    <div class="ticket-cup">
                        ${steam}
                        <img src="${escapeHtml(icon)}" alt="" onerror="this.hidden = true">
                    </div>
                    <div>
                        <div class="ticket-top">
                            <h3 class="ticket-drink">${escapeHtml(order.product_name)}</h3>
                            <span class="ticket-time">${escapeHtml(timeString)}</span>
                        </div>
                        <p class="ticket-who">${escapeHtml(order.customer_name)}</p>
                        ${order.showPending ? '<p class="ticket-pending">מחכה לרשת</p>' : ''}
                        ${order.special_request ? `<p class="ticket-note">${escapeHtml(order.special_request)}</p>` : ''}
                        <div class="ticket-actions">
                            ${action}
                            <button class="act act--kill" type="button" title="בטל הזמנה"
                                    aria-label="בטל הזמנה" onclick="deleteOrder('${safeId}')">✕</button>
                        </div>
                    </div>
                </article>
            `;
        }

        function iconForProduct(productName) {
            const card = document.querySelector(`.drink[data-product="${cssEscape(productName)}"]`);
            return card ? card.dataset.icon : (PRODUCT_ICONS[productName] || './assets/drinks/other.webp');
        }

        /* ---------------- feedback ---------------- */

        function showToast(message, kind = 'ok', life = 3600) {
            const toast = document.createElement('div');
            toast.className = `toast toast--${kind === 'bad' ? 'bad' : 'ok'}`;
            toast.textContent = message;
            document.getElementById('toasts').appendChild(toast);

            setTimeout(() => {
                toast.classList.add('is-out');
                setTimeout(() => toast.remove(), 320);
            }, life);
        }

        // Tiny burst on the ticket that just flipped to ready. Fires on every
        // family phone watching the queue, which is the point.
        function burstOnTicket(orderId) {
            const ticket = document.querySelector(`.ticket[data-order-id="${cssEscape(orderId)}"]`);
            if (!ticket) return;

            const layer = document.createElement('div');
            layer.className = 'pop-layer';
            layer.setAttribute('aria-hidden', 'true');

            const colors = ['#fffdf8', '#d98b41', '#62853d', '#c0553c'];

            for (let i = 0; i < 10; i++) {
                const bit = document.createElement('span');
                bit.className = 'pop';
                const angle = (Math.PI / 10) * i + Math.PI * 0.6;
                bit.style.setProperty('--dx', `${Math.cos(angle) * (48 + (i % 3) * 20)}px`);
                bit.style.setProperty('--dy', `${-Math.abs(Math.sin(angle)) * (40 + (i % 4) * 18)}px`);
                bit.style.setProperty('--rot', `${(i % 2 ? 1 : -1) * (120 + i * 22)}deg`);
                bit.style.setProperty('--c', colors[i % colors.length]);
                bit.style.setProperty('--d', `${i * 0.024}s`);
                layer.appendChild(bit);
            }

            ticket.appendChild(layer);
            setTimeout(() => layer.remove(), 1100);
        }

        function setFieldError(fieldId, errorId, message) {
            const field = document.getElementById(fieldId);
            const error = document.getElementById(errorId);
            field.classList.remove('has-error');
            void field.offsetWidth;
            field.classList.add('has-error');
            field.querySelector('input').setAttribute('aria-invalid', 'true');
            error.textContent = message;
            error.hidden = false;
        }

        function clearFieldError(fieldId, errorId) {
            document.getElementById(fieldId).classList.remove('has-error');
            document.getElementById(fieldId).querySelector('input').setAttribute('aria-invalid', 'false');
            const error = document.getElementById(errorId);
            error.hidden = true;
            error.textContent = '';
        }

        function cssEscape(value) {
            return String(value).replace(/["\\]/g, '\\$&');
        }

        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[char]);
        }

        function showOrderCelebration(productName) {
            showToast(productName ? `${productName} נכנס לתור · הבריסטה על זה` : 'ההזמנה נכנסה לתור', 'ok', 3200);
        }

