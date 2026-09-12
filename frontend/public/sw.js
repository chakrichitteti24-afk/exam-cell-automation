self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // Attempt to parse vibrate array, default to a standard pattern
    const vibratePattern = data.vibrate || [300, 100, 300, 100, 300];

    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: vibratePattern,
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(data.title, options),
        clients.matchAll({ type: 'window' }).then(windowClients => {
          windowClients.forEach(client => {
            client.postMessage({
              type: 'PUSH_RECEIVED',
              payload: data
            });
          });
        })
      ])
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          let client = windowClients[i];
          if (client.url.includes(event.notification.data.url) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new one
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});
