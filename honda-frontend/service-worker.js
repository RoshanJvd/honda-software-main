const CACHE_NAME = 'honda-pwa-cache-v1';
const urlsToCache = [
  './index.html',
  './style.css',
  './APP.JS',
  './api.js',
  './backend.js',
  './login.html',
  './login.js',
  './Atlas-Honda-logo.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});