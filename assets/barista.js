(() => {
  let counts = {total: 0, preparing: 0, ready: 0};
  const sound = document.getElementById('orderChime');
  const soundToggle = document.getElementById('soundToggle');
  const alert = document.getElementById('newOrderAlert');
  let soundEnabled = false, initialized = false, alertTimer, latestOrderId;
  const seen = new Set();
  sound.volume = .65;

  function update() {
    const filter = document.body.dataset.filter;
    document.getElementById('totalCount').textContent = counts.total;
    document.getElementById('readyCount').textContent = counts.ready;
    const empty = document.getElementById('filterEmpty');
    empty.hidden = filter === 'all' || counts.total === 0 || counts.ready > 0;
    empty.textContent = 'אין כרגע הזמנות מוכנות לאיסוף.';
    document.getElementById('queueUpdate').textContent = `${counts.total} הזמנות, ${counts.ready} מוכנות לאיסוף`;
  }
  function selectFilter(filter) {
    document.body.dataset.filter = filter;
    document.querySelectorAll('.barista-filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    update();
  }
  function setSound(enabled) {
    soundEnabled = enabled;
    soundToggle.setAttribute('aria-pressed', String(enabled));
    document.getElementById('soundLabel').textContent = enabled ? 'צליל פעיל' : 'הפעלת צליל';
  }
  async function playChime() {
    try {
      sound.currentTime = 0;
      await sound.play();
      return true;
    } catch {
      setSound(false);
      return false;
    }
  }
  // Safari needs an explicit tap to unlock sound. This also previews the chime.
  soundToggle.addEventListener('click', async () => {
    if (soundEnabled) { sound.pause(); setSound(false); return; }
    soundToggle.disabled = true;
    const played = await playChime();
    setSound(played);
    soundToggle.disabled = false;
    showToast(played ? 'הצליל פעיל כל עוד מסך הבריסטה פתוח' : 'הצליל לא הופעל. אפשר לנסות שוב; ההתראות ימשיכו להופיע.', played ? 'ok' : 'bad');
  });

  document.addEventListener('coffee:orders', event => { counts = event.detail; update(); });
  document.querySelectorAll('.barista-filters button').forEach(button => button.addEventListener('click', () => selectFilter(button.dataset.filter)));

  document.addEventListener('coffee:feed', event => {
    const rows = event.detail;
    // Opening the screen is not a new order. Ignore that initial snapshot.
    if (!initialized) { rows.forEach(row => seen.add(row.id)); initialized = true; return; }
    const fresh = rows.filter(row => !seen.has(row.id) && !row.pending && row.status === 'preparing');
    rows.filter(row => !row.pending).forEach(row => seen.add(row.id));
    if (!fresh.length) return;
    latestOrderId = fresh[0].id;
    document.getElementById('newOrderText').textContent = fresh.length === 1
      ? `${fresh[0].customer_name} · ${fresh[0].product_name}`
      : `${fresh.length} הזמנות חדשות מחכות לך`;
    alert.hidden = false;
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => { alert.hidden = true; }, 9000);
    if (soundEnabled) playChime();
  });
  document.getElementById('newOrderDismiss').addEventListener('click', () => { alert.hidden = true; clearTimeout(alertTimer); });
  document.getElementById('newOrderOpen').addEventListener('click', () => {
    selectFilter('all');
    alert.hidden = true;
    clearTimeout(alertTimer);
    const ticket = [...document.querySelectorAll('.ticket')].find(el => el.dataset.orderId === latestOrderId);
    if (ticket) {
      ticket.scrollIntoView({block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      ticket.tabIndex = -1;
      ticket.focus({preventScroll: true});
    }
  });
})();
