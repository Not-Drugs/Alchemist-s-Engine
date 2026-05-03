// Alchemist's Engine — minimal offline-first service worker
// Cache-first for the tiny shell, network-first for everything else.

const CACHE = 'alchemists-engine-v140';
const SHELL = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './qrcode.js',
    './manifest.webmanifest',
    './icon.svg'
];

// Force a fresh fetch for every shell file at install time so the SW cache
// can't silently inherit stale HTTP-cached copies (the bug that pinned
// users to v22 even after multiple reloads).
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

// On activate: clear old caches, claim existing tabs, and — if this was
// an upgrade (not a first install) — tell every controlled tab to reload
// so the new shell takes effect immediately.
self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        const stale = keys.filter((k) => k !== CACHE);
        const isUpgrade = stale.length > 0;
        await Promise.all(stale.map((k) => caches.delete(k)));
        await self.clients.claim();
        if (isUpgrade) {
            const clients = await self.clients.matchAll({ includeUncontrolled: true });
            for (const client of clients) {
                client.postMessage({ type: 'sw-updated', version: CACHE });
            }
        }
    })());
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
