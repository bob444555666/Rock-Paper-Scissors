// Notix service-worker integration (publisher zone).
self.options = {
  domain: "5gvci.com",
  zoneId: 12241366
};
self.lary = "";

// A third-party advertising script must not prevent the game's own
// service worker from installing if the remote script is unavailable.
try {
  importScripts("https://5gvci.com/act/files/service-worker.min.js?r=sw");
} catch (error) {
  console.warn("Notix service worker could not be loaded:", error);
}

// RPS offline-cache service worker.
// Network first, then fall back to cached files while offline.
// Only same-origin GET requests are cached; game APIs and external ads
// are not intercepted by this cache handler.
const CACHE = "rps-v37";
const SHELL = [
  "/", "/index.html", "/game-lab.html", "/game-lab.css", "/game-lab.js",
  "/developer-lab.html", "/developer-lab.js", "/developer-live.js",
  "/leaderboard.html", "/privacy.html", "/music.html", "/minigames.html",
  "/competitive-lab.html", "/12-rock-paper-scissors.css", "/site-wide.css",
  "/12-rock-paper-scissors.js", "/challenge.js", "/ai.js", "/tournament.js",
  "/premium.js", "/premium-global.js", "/sunburst-pop.js", "/sunburst-pop.css",
  "/multiplayer.html", "/multiplayer.js", "/arcade-hub.html", "/arcade.js",
  "/arcade.html", "/arcade-game.js", "/quests.html", "/quests.js",
  "/achievements.html", "/achievements.js", "/vault.html", "/vault.js",
  "/subscribe.html", "/subscribe.js", "/competitive-lab.js", "/staff.js",
  "/favicon.svg", "/favicon-192.png", "/favicon-512.png",
  "/icon-maskable-512.png", "/manifest.json",
  "/images/rock-emoji.png", "/images/paper-emoji.png",
  "/images/scissors-emoji.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(hit =>
          hit || caches.match(url.pathname).then(pathHit => pathHit || caches.match("/index.html"))
        )
      )
  );
});
