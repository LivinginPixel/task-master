// TaskMaster Service Worker — v4
const CACHE_NAME = 'task-master-v4';

self.addEventListener('install', (event) => {
  // Skip waiting immediately so the new SW takes over without delay
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Delete old caches, claim clients, sync scheduled notifications
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
    self.clients.claim(),
    syncStoredNotifications(),
  ]));
});

// ─── Web Push ─────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: 'TaskMaster', body: event.data.text() }; }
  const { title, body, taskId, type } = payload;
  event.waitUntil(
    self.registration.showNotification(title || 'TaskMaster', {
      body: body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: taskId ? `task-${taskId}` : `tm-${Date.now()}`,
      requireInteraction: type === 'overdue',
      vibrate: [200, 100, 200],
      data: { taskId, type, url: taskId ? `/dashboard?task=${taskId}` : '/dashboard' },
      actions: taskId ? [{ action: 'open', title: 'View task' }, { action: 'complete', title: 'Mark done' }] : [],
    })
  );
});

// ─── Notification click — deep link + refresh ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { taskId, url } = event.notification.data || {};
  const targetUrl = url || (taskId ? `/dashboard?task=${taskId}` : '/dashboard');
  const action = event.action;

  event.waitUntil((async () => {
    if (action === 'complete' && taskId) {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', completedAt: new Date().toISOString() }),
      }).catch(() => {});
    }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).pathname.startsWith('/dashboard')) {
        await client.focus();
        client.postMessage({ type: 'NOTIFICATION_CLICK', taskId, action, navigateTo: targetUrl });
        return;
      }
    }
    const newClient = await self.clients.openWindow(targetUrl);
    if (newClient) {
      setTimeout(() => newClient.postMessage({ type: 'NOTIFICATION_CLICK', taskId, action }), 1500);
    }
  })());
});

// ─── Messages from main thread ────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  // All async work must be wrapped in event.waitUntil() so the browser
  // doesn't garbage-collect the promise mid-flight (avoids "went out of scope" error)
  if (type === 'SCHEDULE_NOTIFICATION') {
    const { taskId, notificationType, scheduledTime, task } = event.data;
    const delay = scheduledTime - Date.now();
    event.waitUntil(
      storeNotification(taskId, notificationType, scheduledTime, task).then(() => {
        if (delay <= 0 && delay > -60000) {
          return fireNotification(task, notificationType)
            .then(() => cancelNotification(taskId, notificationType));
        } else if (delay > 0) {
          setTimeout(() => {
            fireNotification(task, notificationType).catch(() => {});
            cancelNotification(taskId, notificationType).catch(() => {});
          }, delay);
        }
      }).catch(() => {})
    );
  } else if (type === 'CANCEL_NOTIFICATION') {
    event.waitUntil(cancelNotification(event.data.taskId, event.data.notificationType).catch(() => {}));
  } else if (type === 'CLEAR_ALL_NOTIFICATIONS') {
    event.waitUntil(clearAllNotifications().catch(() => {}));
  } else if (type === 'SYNC_NOTIFICATIONS') {
    event.waitUntil(syncStoredNotifications().catch(() => {}));
  } else if (type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

setInterval(() => syncStoredNotifications().catch(() => {}), 60000);
self.addEventListener('sync', (event) => { if (event.tag === 'sync-notifications') event.waitUntil(syncStoredNotifications()); });

// ─── Fire notification ────────────────────────────────────────────────────────
async function fireNotification(task, notificationType) {
  if (task.status === 'COMPLETED' || task.notificationsMuted) return;
  if (task.snoozedUntil && new Date(task.snoozedUntil) > new Date()) return;
  const map = {
    'start-5min-before': ['⏰ Starting in 5 min', `"${task.title}" is about to start`],
    '5min-before':       ['⏰ Due in 5 minutes',  `"${task.title}" is due very soon`],
    '15min-before':      ['🔔 Due in 15 minutes', `"${task.title}" is due soon`],
    '30min-before':      ['🔔 Due in 30 minutes', `"${task.title}" — don't forget!`],
    'due-now':           ['🚨 Due now',           `"${task.title}" is due right now`],
    'overdue':           ['⚠️ Task overdue',      `"${task.title}" is past its deadline`],
  };
  const [title, body] = map[notificationType] || ['TaskMaster', task.title];
  await self.registration.showNotification(title, {
    body, icon: '/logo.png', badge: '/logo.png',
    tag: `${task.id}-${notificationType}`,
    requireInteraction: notificationType === 'overdue',
    vibrate: [200, 100, 200],
    data: { taskId: task.id, type: notificationType, url: `/dashboard?task=${task.id}` },
    actions: [{ action: 'open', title: 'View task' }, { action: 'complete', title: 'Mark done' }],
  });
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'NOTIFICATION_FIRED', taskId: task.id, notificationType }));
}

// ─── IndexedDB ────────────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('TaskMasterNotifications', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id' });
        store.createIndex('scheduledTime', 'scheduledTime');
      }
    };
  });
}
async function storeNotification(taskId, notificationType, scheduledTime, task) {
  try { const db = await openDB(); db.transaction(['notifications'], 'readwrite').objectStore('notifications').put({ id: `${taskId}-${notificationType}`, taskId, notificationType, scheduledTime, task: JSON.stringify(task), createdAt: Date.now() }); } catch {}
}
async function cancelNotification(taskId, notificationType) {
  try { const db = await openDB(); db.transaction(['notifications'], 'readwrite').objectStore('notifications').delete(`${taskId}-${notificationType}`); } catch {}
}
async function clearAllNotifications() {
  try { const db = await openDB(); db.transaction(['notifications'], 'readwrite').objectStore('notifications').clear(); } catch {}
}
async function syncStoredNotifications() {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains('notifications')) return;
    const all = await new Promise((resolve, reject) => {
      const req = db.transaction(['notifications'], 'readonly').objectStore('notifications').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    const now = Date.now();
    for (const n of all) {
      const delay = n.scheduledTime - now;
      const task = JSON.parse(n.task);
      if (delay <= 0 && delay > -60000) { fireNotification(task, n.notificationType); cancelNotification(n.taskId, n.notificationType); }
      else if (delay > 0) setTimeout(() => { fireNotification(task, n.notificationType); cancelNotification(n.taskId, n.notificationType); }, delay);
      else cancelNotification(n.taskId, n.notificationType);
    }
  } catch {}
}
