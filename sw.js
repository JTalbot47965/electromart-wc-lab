// sw.js: the service worker. It lets the app install and work offline.
// Strategy: network first. Every request goes to GitHub Pages first, so a
// merged change shows up on the next load. A copy of each file is kept in the
// cache, and that copy is used only when the network can't be reached.
// All paths are relative, because the site lives at /<repository>/.

var CACHE = "electromart-ccc-v1";

var FILES = [
  "./",
  "index.html",
  "styles.css",
  "ccc.js",
  "app.js",
  "manifest.webmanifest",
  "data/electromart.csv",
  "data/assumptions.csv",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

// On install, save a copy of every file the app needs.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

// On activate, delete caches from older versions and take control right away.
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Network first, cache as the offline fallback.
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("./");
        return Response.error();
      });
    })
  );
});
