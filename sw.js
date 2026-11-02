// Fonctionnement hors connexion : réseau d'abord, copie locale si pas de réseau.
const CACHE = 'ptpsc-3.0'; // à changer à chaque nouvelle version
const FILES = ['./', 'index.html', 'js/config.js?v=3.0', 'js/piste.js?v=3.0', 'js/sons.js?v=3.0', 'js/famille.js?v=3.0', 'js/game.js?v=3.0', 'js/accueil.js?v=3.0', 'img/logo-titre.png', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // « no-cache » : on redemande toujours au serveur s'il y a une nouvelle version
  const req = e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
