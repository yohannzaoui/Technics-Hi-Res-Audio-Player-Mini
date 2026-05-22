const CACHE_NAME = 'Technics-HR-v11';
const ASSETS = [
  './',
  './index.html',
  './css/common.css',
  './css/style-dark.css',
  './script.js',
  './img/technics_brand_1.webp',
  './img/technics_brand_2.webp',
  './img/technics_cover.png',
  './img/class_aa_2.png',
  './img/favicon.png',
  './img/w6L.webp',
  './img/w6R.webp',
  './img/dsp-w.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching assets');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});