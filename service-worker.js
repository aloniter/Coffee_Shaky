const CACHE = "shaky-cache-v7";

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

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(
    caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
      const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;
    }))
  );
});
