/* ---- Coffee Shaky PWA Service-Worker ---- */
const CACHE_NAME = "shaky-cache-v2";

/* משאבים לאחסון-מראש */
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  /* אייקון האפליקציה */
  "./appicon-192.png",
  "./appicon-512.png",
  /* אייקוני המשקאות */
  "./espresso.png",
  "./macchiatoIcon.png",
  "./cappuccinoIcon.png",
  "./americanoIcon.png",
  "./teaIcon.png"
];

/* install – cache everything */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

/* activate – clean old caches */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* fetch – cache-first, then network, then fallback */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;               // ignore POST/PUT
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(resp => {
          /* save fresh copy */
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, respClone));
          return resp;
        })
        .catch(() => cached || caches.match("./index.html")); // offline fallback
      return cached || fetchPromise;
    })
  );
});
