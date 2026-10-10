// 맹고 웹 푸시 서비스 워커. 설정 > 알림을 켠 브라우저에만 등록한다(lib/web-push.ts).
// FCM이 보낸 알림을 띄우고, 누르면 그 화면(오늘의 맹고)을 연다. 요청(fetch)은 가로채지 않는다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let p = {};
  try {
    p = e.data ? e.data.json() : {};
  } catch {}
  const n = p.notification || {};
  const path = (p.data && p.data.path) || '/today';
  const link = (p.fcmOptions && p.fcmOptions.link) || new URL(path, self.location.origin).href;
  e.waitUntil(
    self.registration.showNotification(n.title || '맹고', {
      body: n.body || '',
      icon: '/apple-icon',
      // 같은 날 알림이 여러 번 와도 하나만 남긴다
      tag: 'maengo-today',
      data: { link },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/today';
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        try {
          await open.navigate(link);
          return;
        } catch {}
      }
      await self.clients.openWindow(link);
    })(),
  );
});
