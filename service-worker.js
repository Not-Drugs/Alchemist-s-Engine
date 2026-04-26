// Alchemist's Engine — minimal offline-first service worker
// Cache-first for the tiny shell, network-first for everything else.

const CACHE = 'alchemists-engine-v19';
const SHELL = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './qrcode.js',
    './manifest.webmanifest',
    './icon.svg'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Only handle same-origin shell requests; let the network handle the rest.
    if (url.origin !== self.location.origin) return;

    e.respondWith(
        caches.match(req).then((cached) => {
            if (cached) {
                // Revalidate in the background so updates propagate next load.
                fetch(req).then((fresh) => {
                    if (fresh && fresh.ok) {
                        caches.open(CACHE).then((c) => c.put(req, fresh.clone()));
                    }
                }).catch(() => {});
                return cached;
            }
            return fetch(req).then((fresh) => {
                if (fresh && fresh.ok) {
                    const copy = fresh.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy));
                }
                return fresh;
            }).catch(() => caches.match('./index.html'));
        })
    );
});
