// Service Worker para Notificações Push & Invalidação de Cache - CIMADEBE / SIGM
const CACHE_NAME = 'sigm-push-cache-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listener de eventos Push recebidos via Web Push API
self.addEventListener('push', (event) => {
  let data = {
    title: '📢 CIMADEBE / SIGM - Notificação Oficial',
    body: 'Você possui uma nova notificação do sistema ministerial.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'sigm-push-alert',
    url: '/',
    vibrate: [200, 100, 200]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const tipo = data.tipo || data.type || '';
  let actions = [
    { action: 'abrir', title: '🔍 Ver Detalhes' },
    { action: 'fechar', title: '✖ Fechar' }
  ];

  if (tipo === 'noticia') {
    data.title = data.title || '📰 Nova Notícia Publicada • CIMADEBE';
    data.tag = data.tag || `sigm-noticia-${data.noticiaId || Date.now()}`;
    data.url = data.url || '/?tab=noticias';
    actions = [
      { action: 'abrir_noticia', title: '📖 Ler Notícia' },
      { action: 'fechar', title: '✖ Fechar' }
    ];
  } else if (tipo === 'ago_convocacao') {
    data.title = data.title || '🏛️ Edital de Convocação da AGO Publicado!';
    data.tag = data.tag || `sigm-ago-${data.eventoId || Date.now()}`;
    data.url = data.url || '/?tab=ago';
    actions = [
      { action: 'abrir_ago', title: '🗳️ Ver Convocação & Inscrever-se' },
      { action: 'fechar', title: '✖ Fechar' }
    ];
  } else if (tipo === 'anuidade') {
    data.title = data.title || '📢 CIMADEBE / SIGM - Alerta Financeiro';
    data.tag = data.tag || `sigm-anuidade-${data.anuidadeId || Date.now()}`;
    data.url = data.url || '/?tab=anuidade';
    actions = [
      { action: 'pagar', title: '💳 Pagar Agora' },
      { action: 'ver', title: '🔍 Ver Detalhes' }
    ];
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    tag: data.tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url,
      tipo,
      noticiaId: data.noticiaId,
      eventoId: data.eventoId,
      anuidadeId: data.anuidadeId,
      timestamp: Date.now()
    },
    actions
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Suporte para mensagens enviadas da aplicação para o Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    const tipo = payload.tipo || payload.data?.tipo || '';
    
    let actions = payload.actions || [
      { action: 'abrir', title: '🔍 Ver Detalhes' },
      { action: 'fechar', title: '✖ Fechar' }
    ];

    if (tipo === 'noticia') {
      actions = [
        { action: 'abrir_noticia', title: '📖 Ler Notícia' },
        { action: 'fechar', title: '✖ Fechar' }
      ];
    } else if (tipo === 'ago_convocacao') {
      actions = [
        { action: 'abrir_ago', title: '🗳️ Ver Convocação & Inscrever-se' },
        { action: 'fechar', title: '✖ Fechar' }
      ];
    } else if (tipo === 'anuidade') {
      actions = [
        { action: 'pagar', title: '💳 Pagar Agora' },
        { action: 'ver', title: '🔍 Ver Detalhes' }
      ];
    }

    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/badge-72.png',
      tag: payload.tag || 'sigm-notificacao',
      renotify: true,
      vibrate: [200, 100, 200],
      data: payload.data || {},
      actions
    };
    event.waitUntil(
      self.registration.showNotification(payload.title || 'CIMADEBE / SIGM', options)
    );
  }
});

// Clique na Notificação Push: Focar ou Abrir a aplicação na aba correta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = event.notification.data?.url || '/';
  const tipo = event.notification.data?.tipo;

  if (event.action === 'abrir_noticia' || tipo === 'noticia') {
    targetUrl = '/?tab=noticias';
  } else if (event.action === 'abrir_ago' || tipo === 'ago_convocacao') {
    targetUrl = '/?tab=ago';
  } else if (event.action === 'pagar' || tipo === 'anuidade') {
    targetUrl = '/?tab=anuidade';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_CLICK',
            action: event.action,
            data: event.notification.data
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
