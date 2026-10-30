// Used only by the localhost preview server. Production keeps Firebase.
let listener, connection, timer, previous = '', refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const response = await fetch('/__preview/orders', { cache: 'no-store' });
    if (!response.ok) throw Error('המטבח המקומי אינו זמין');
    const rows = await response.json();
    const snapshot = JSON.stringify(rows);
    if (snapshot !== previous) {
      previous = snapshot;
      listener?.(rows.map(row => ({ ...row, created_at: new Date(row.created_at) })));
    }
    connection?.(true);
  } catch { connection?.(false); }
  finally { refreshing = false; }
}
async function mutate(data) {
  const response = await fetch('/__preview/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  if (!response.ok) throw Error('המטבח המקומי אינו זמין');
  await refresh();
}
window.CoffeeDB = {
  hasPersistentCache: () => false,
  subscribeToOrders(fn, status) {
    listener = fn; connection = status; previous = '';
    refresh(); timer = setInterval(refresh, 750);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  },
  newOrderId: () => crypto.randomUUID(),
  createOrder: order => mutate({ action: 'create', order }),
  updateOrderStatus: (id, status) => mutate({ action: 'status', id, status }),
  removeOrder: id => mutate({ action: 'remove', ids: [id] }),
  removeOrders: ids => mutate({ action: 'remove', ids })
};
