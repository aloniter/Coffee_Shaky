const CACHE = "coffee-shaky-cache-v9";

const ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./service-worker.js",
    "./espresso.png",
    "./macchiatoIcon.png",
    "./cappuccinoIcon.png",
    "./americanoIcon.png",
    "./teaIcon.png"
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", e => {
    if (e.request.method !== "GET") return;
    
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) {
                return cached;
            }
            
            return fetch(e.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => {
                        cache.put(e.request, clone);
                    });
                }
                return response;
            }).catch(() => {
                // Return offline page or cached version if available
                return caches.match('./index.html');
            });
        })
    );
});
