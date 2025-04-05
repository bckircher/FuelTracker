// Copyright (c) 2025 Brian Kircher
//
// Open Source Software: you can modify and/or share it under the terms of the
// BSD license file in the root directory of this project.

const prefix = "fuel-tracker-";

const cacheName = `${prefix}site-v1`;

const assets =
[
  "dialogs/drawdown.md",
  "dialogs/fontawesome.md",
  "dialogs/idb.md",
  "dialogs/jquery.md",
  "dialogs/plotly.md",
  "external/font-awesome-4.7.0/css/font-awesome.min.css",
  "external/font-awesome-4.7.0/fonts/fontawesome-webfont.eot",
  "external/font-awesome-4.7.0/fonts/fontawesome-webfont.svg",
  "external/font-awesome-4.7.0/fonts/fontawesome-webfont.ttf",
  "external/font-awesome-4.7.0/fonts/fontawesome-webfont.woff",
  "external/font-awesome-4.7.0/fonts/fontawesome-webfont.woff2",
  "external/font-awesome-4.7.0/fonts/FontAwesome.otf",
  "external/drawdown.js",
  "external/idb-8.js",
  "external/jquery-3.7.1.min.js",
  "external/plotly-3.0.1.min.js",
  "app.js",
  "favicon.webp",
  "index.html",
  "styles.css",
  "sw.js",
];

self.addEventListener("install", evt => {
  evt.waitUntil(
    caches.open(cacheName).then(cache => {
      cache.addAll(assets);
    })
  )
});

self.addEventListener("activate", async evt => {
  evt.waitUntil(
    caches.keys().then(cacheList => {
      return(Promise.all(
        cacheList.map(cache => {
          if((cache.substring(0, prefix.length) === prefix) &&
             (cache !== cacheName)) {
            return(caches.delete(cache));
          }
        })
      ));
    })
  )
});

self.addEventListener("fetch", evt => {
  evt.respondWith(
    caches.match(evt.request).then(res => {
      return(res || fetch(evt.request));
    })
  );
});