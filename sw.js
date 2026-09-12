// sw.js
self.addEventListener('fetch', (event) => {
  // This acts as a pass-through so the browser sees an active worker
  event.respondWith(fetch(event.request));
});
