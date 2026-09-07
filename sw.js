/**
 * Stitch Math service worker.
 *
 * The offline claim on the tin is only true if this file exists: opened from a file:// path the app
 * works offline by accident, but served from a URL - which is how anyone else will ever get it - a
 * browser with no network shows nothing at all without a worker to answer for it.
 *
 * THREE STRATEGIES, and the split is the whole design.
 *
 *   - A navigation (the page itself) is network-first. index.html is the manifest that names every
 *     other file, so serving a stale one is how a browser ends up running yesterday's HTML against
 *     today's scripts - a mixture that never existed and cannot be reproduced from a bug report.
 *   - A content-hashed asset - app.5f6a701e.js - is cache-first and never revalidated. The name
 *     changes when the bytes do, so a hit cannot be wrong. This is the fast path, and in dist/ it is
 *     the whole app.
 *   - Everything else is network-first with the cache as the offline fallback: an icon, the manifest,
 *     and every file in the unhashed source tree. These can change under a name they keep, and
 *     answering them from the cache is how a reload shows code you edited a minute ago.
 *
 * That last rule is not theoretical. This file used to be stale-while-revalidate for everything, and
 * against the source tree - where nothing is hashed and the ?v= stamp never moves - it put every save
 * one reload behind, and cost a debugging session on a validator bug that had already been fixed and
 * was being answered out of a cache. Correctness first here; the speed comes from the hashed path.
 *
 * CACHE_NAME carries the version deliberately. Bump APP_VERSION in app.js and bump it here, and every
 * old cache is dropped on activate rather than being selectively invalidated - selective invalidation
 * is where this kind of file usually goes wrong. In dist/ the build writes both: VERSION from the
 * bundle hash, PRECACHE from the filenames it actually emitted.
 */
const VERSION = '1.0.0';
const CACHE_NAME = `stitch-math-${VERSION}`;

/* The shell, in load order. Everything the app needs to open with no network at all. */
/* The query strings match index.html exactly, and they have to: a cache keyed on './app.js' would
   never answer a request for './app.js?v=1.0.0', so the entry would sit there unused while the
   network was hit every time. tests.js is absent deliberately: it is a development harness, and the
   worker IS registered on a dev origin - which is why the unhashed rule below has to be right. */
const PRECACHE = [
    './',
    './index.html',
    `./style.css?v=${VERSION}`,
    `./validator.js?v=${VERSION}`,
    `./analytics.js?v=${VERSION}`,
    `./persistence.js?v=${VERSION}`,
    `./pdf.js?v=${VERSION}`,
    `./app.js?v=${VERSION}`,
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // addAll is all-or-nothing: one 404 and the whole install fails, leaving the previous
            // worker in place. That is the behaviour worth having - a half-populated cache is an app
            // that opens offline and then breaks halfway down the page.
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(n => n.startsWith('stitch-math-') && n !== CACHE_NAME)
                     .map(n => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

/* A build output: app.5f6a701e.js, style.e67d39d0.css. Eight hex characters between two dots is the
   shape build.js emits, and nothing in the source tree matches it - which is exactly the line being
   drawn. A name of this shape cannot change contents without changing name. */
const IMMUTABLE = /\.[0-9a-f]{8}\.(?:js|css)(?:\?|$)/;

function fetchAndCache(request) {
    return fetch(request).then(response => {
        if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
    });
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    // Never answer for another origin. Google Fonts and anything else can look after itself; caching
    // a cross-origin opaque response here would fill the quota with things we cannot even inspect.
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
        );
        return;
    }

    if (IMMUTABLE.test(url.pathname + url.search)) {
        // Cache-first and no revalidation. Re-fetching a hashed file to check whether it changed is
        // work that can only ever confirm it did not.
        event.respondWith(caches.match(request).then(hit => hit || fetchAndCache(request)));
        return;
    }

    // Everything else. Network wins when there is one; the cache is what makes the app work when
    // there is not. Slower than answering from the cache, and right, which is the trade this file
    // got wrong the first time.
    event.respondWith(
        fetchAndCache(request).catch(() => caches.match(request))
    );
});
