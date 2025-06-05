const CACHE_NAME = "coffee-shaky-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./espresso.png",
  "./macchiatoIcon.png",
  "./cappuccinoIcon.png",
  "./americanoIcon.png",
  "./teaIcon.png"
];

// התקנה – שמירת קבצים סטטיים בלבד
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

// שלב fetch – מטפלים רק ב־GET ובבקשות same-origin
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // מחוץ לאתר שלנו? לא מתערבים
  if (url.origin !== self.location.origin || event.request.method !== "GET") {
    return;
  }

  // otherwise – cache-first
  event.respondWith(
    caches.match(event.request).then(
      res => res || fetch(event.request)
    )
  );
});
