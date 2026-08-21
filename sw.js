const CACHE="woodprep-v0.3.4";
const FILES=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
