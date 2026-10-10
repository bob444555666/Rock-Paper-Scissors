// Simple service worker: network first, falls back to cache when offline.
// Only handles same-site GET requests, so your game server, login and ads are never touched.
const CACHE = 'rps-v12'
const SHELL = ['/', '/index.html', '/leaderboard.html', '/privacy.html', '/12-rock-paper-scissors.css', '/12-rock-paper-scissors.js', '/challenge.js', '/ai.js', '/tournament.js', '/premium.js', '/premium-global.js', '/staff.js', '/favicon-192.png', '/favicon-512.png', '/manifest.json', '/images/rock-emoji.png', '/images/paper-emoji.png', '/images/scissors-emoji.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {})))).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(cache => cache.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('/index.html')))
  )
})
