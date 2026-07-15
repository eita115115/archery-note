const CACHE = "archery-note-v83";
const CACHE_PREFIX = "archery-note-v";
/* 射形トラッキングの pose 資産（assets/pose/ の wasm+モデル、約15MB・内容固定）専用キャッシュ。
   名前を CACHE_PREFIX("archery-note-v") に前方一致させないことで、activate の
   旧バージョン掃除（startsWith(CACHE_PREFIX)）に消されず、アプリ更新をまたいで生存する。
   運用: assets/pose/ の資産を差し替える日は POSE_CACHE を "archery-note-pose-v2" に上げる。 */
const POSE_CACHE = "archery-note-pose-v1";
const APP_SCRIPTS = [
  "./scripts/00-compat.js",
  "./scripts/10-storage-native.js",
  "./scripts/20-scoring.js",
  "./scripts/30-target-svg.js",
  "./scripts/40-analysis-physics.js",
  "./scripts/45-analysis-core.js",
  "./scripts/46-form-core.js",
  "./scripts/47-form-view.js",
  "./scripts/48-gamification.js",
  "./scripts/49-todays-result.js",
  "./scripts/50-record-view.js",
  "./scripts/60-history-sight-view.js",
  "./scripts/70-gear-settings.js",
  "./scripts/90-init.js",
];
const ASSETS = ["./index.html", "./style.min.css", ...APP_SCRIPTS, "./manifest.json", "./icon.svg", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  // 掃除対象は CACHE_PREFIX 前方一致のみ。POSE_CACHE("archery-note-pose-v1") は
  // 前方一致しないため消さない（pose 資産の再ダウンロード防止。上の POSE_CACHE コメント参照）
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
  // pose 資産だけは cache-first（内容固定の大容量サードパーティ成果物のため）。
  // ネット優先だと HTTP キャッシュ失効（GitHub Pages は max-age=600）後の解析開始ごとに
  // 約15MB を再ダウンロードしてしまう。オフライン＋未キャッシュ時は fetch の失敗が
  // そのまま伝播する（従来のネット優先経路でも未キャッシュなら失敗するのと同等）。
  // 照会は POSE_CACHE に限定する（全キャッシュ横断の caches.match だと旧世代キャッシュの
  // pose エントリが先にヒットし、POSE_CACHE の世代切り替えが効かなくなるため）。
  // 既知の制約: 旧世代の pose キャッシュ（pose-v1 等）は activate の掃除では消えず残留する。
  // 現行ローダー（47-form-view.js）はクエリなし URL のみ生成する前提。クエリ付きで読む変更を入れる場合はキャッシュ肥大に注意。
  if (url.origin === self.location.origin && url.pathname.includes("/assets/pose/")) {
    e.respondWith(
      caches.open(POSE_CACHE).then(c => c.match(e.request)).then(hit => hit || fetch(e.request).then(res => {
        // status 200 のみ保存（206 部分レスポンスは Cache.put が TypeError で reject する）。
        // put は waitUntil で応答返却後も完走させ、quota 超過等の reject は無害化する。
        if (res && res.status === 200) {
          const copy = res.clone();
          e.waitUntil(caches.open(POSE_CACHE).then(c => c.put(e.request, copy)).catch(() => {}));
        }
        return res;
      }))
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // キャッシュ肥大防止: version.json?ts= / index.html?appv= のような
        // クエリ付きユニークURLと外部オリジンは保存しない
        const cacheable = url.origin === self.location.origin && url.search === "";
        if (cacheable && res && res.ok) {
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
