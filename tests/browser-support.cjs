const { chromium, webkit } = require('playwright');

// Tests never connect to Firebase. Only localhost and font GETs are allowed.
async function isolateDatabase(page) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/firebase-config.js') return route.fulfill({ body: '', contentType: 'application/javascript' });
    if (url.pathname === '/firebase-db.js') return route.fulfill({ contentType: 'application/javascript', body: `
      let rows = [], listener, connection, counter = 0;
      const emit = () => listener?.(rows.map(row => ({ ...row })));
      window.__testDB = { calls: [], offline: false, fail: false, publish: emit };
      window.CoffeeDB = {
        hasPersistentCache: () => true,
        subscribeToOrders(fn, status) { listener = fn; connection = status; emit(); status(true); return () => {}; },
        newOrderId: () => 'local-test-' + (++counter),
        async createOrder(order) {
          window.__testDB.calls.push(order);
          if (window.__testDB.fail) throw Error('Test connection failure');
          rows.push({ id: order.id, product_name: order.productName, customer_name: order.customerName,
            special_request: order.specialRequest, status: 'preparing', created_at: new Date(), pending: window.__testDB.offline });
          emit();
          if (window.__testDB.offline) { connection(false); return new Promise(() => {}); }
        },
        async updateOrderStatus(id, status) { rows.find(r => r.id === id).status = status; emit(); },
        async removeOrder(id) { rows = rows.filter(r => r.id !== id); emit(); },
        async removeOrders(ids) { rows = rows.filter(r => !ids.includes(r.id)); emit(); }
      };
    ` });
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    if (route.request().method() === 'GET' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.continue();
    return route.abort();
  });
}

async function launch(engine = 'chromium') {
  if (engine === 'webkit') return webkit.launch({ headless: true });
  return chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
}
module.exports = { isolateDatabase, launch };
