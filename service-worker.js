const CACHE = "coffee-shaky-cache-v10"; // Changed from v9 to v10

const ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./appicon.png", // Added app icon to cache
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
                keys.filter(key => key !== CACHE) // Deletes any cache that is not the new one
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
            // Serve from cache if available
            if (cached) {
                return cached;
            }
            
            // Otherwise, fetch from network
            return fetch(e.request).then(response => {
                // If fetch is successful, clone it and add to cache
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => {
                        cache.put(e.request, clone);
                    });
                }
                return response;
            }).catch(() => {
                // If network fails, return the main page
                return caches.match('./index.html');
            });
        })
    );
});
