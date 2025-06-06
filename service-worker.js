/* ---- Coffee Shaky PWA Service-Worker ---- */
const CACHE_NAME = "shaky-cache-v5";        // ← גרסה חדשה

/* משאבים לאחסון-מראש */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  /* אייקון האפליקציה */
  "./appicon.png",
  /* אייקוני המשקאות */
  "./espresso.png",
  "./macchiatoIcon.png",
  "./cappuccinoIcon.png",
  "./americanoIcon.png",
  "./teaIcon.png"
];

/* install – precache */
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();           // השתלטות מיידית
});

/* activate – ניקוי קאש ישן */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* fetch – cache-first, refresh in background */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || network;
    })
  );
});
