/* 技能五子棋 Service Worker —— 让游戏可"添加到主屏幕"、并可离线打开 */
const CACHE = 'skill-gomoku-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './taiji.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
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

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  // 只接管同源资源；MQTT(WebSocket) 与其它外部请求放行
  if (url.origin !== self.location.origin) return;

  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc) {
    // 页面：网络优先，保证改动一上线就能看到；离线时回落到缓存
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // 其它同源静态资源：缓存优先，首次访问后写入缓存
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
