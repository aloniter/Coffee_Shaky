const CACHE_NAME = "coffee-shaky-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./espresso.png",
  "./macchiatoIcon.png",
  "./cappuccinoIcon.png",
  "./americanoIcon.png",
  "./teaIcon.png"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});