const CACHE = "archery-note-v67";
const CACHE_PREFIX = "archery-note-v";
const APP_SCRIPTS = [
  "./scripts/00-compat.js",
  "./scripts/10-storage-native.js",
  "./scripts/20-scoring.js",
  "./scripts/30-target-svg.js",
  "./scripts/40-analysis-physics.js",
  "./scripts/45-analysis-core.js",
  "./scripts/46-form-core.js",
  "./scripts/47-form-view.js",
  "./scripts/50-record-view.js",
  "./scripts/60-history-sight-view.js",
  "./scripts/70-gear-settings.js",
  "./scripts/90-init.js",
];
const ASSETS = ["./index.html", "./style.css", ...APP_SCRIPTS, "./manifest.json", "./icon.svg", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// ネット優先・失敗時キャッシュ（更新を取り込みつつオフラインでも動く）
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // キャッシュ肥大防止: version.json?ts= / index.html?appv= のような
        // クエリ付きユニークURLと外部オリジンは保存しない
        const cacheable = url.origin === self.location.origin && url.search === "";
        if (cacheable && res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => e.request.mode === "navigate"
        ? caches.match("./index.html")
        : caches.match(e.request, { ignoreSearch: true }))
  );
});
