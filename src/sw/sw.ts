// The service worker: the browser runs it in the background, even with the site
// closed, to show the notifications the server sends (`src/push/schedule.ts`) and to
// open the calendar when one is tapped. It caches nothing: the site needs the network.
// A plain script, not a module: older browsers register no module service worker.

const worker = self as unknown as ServiceWorkerGlobalScope;

interface PushMessage {
  title: string;
  body: string;
  tag: string;
  url: string;
}

// Takes charge of the open tabs at once, so a tapped notification can reload them.
worker.addEventListener("activate", (event) => {
  event.waitUntil(worker.clients.claim());
});

worker.addEventListener("push", (event) => {
  const message = event.data?.json() as PushMessage | undefined;
  if (message === undefined) return;
  event.waitUntil(
    worker.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/static/icons/icon-192.png",
      data: { url: message.url },
    }),
  );
});

worker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url } = event.notification.data as { url: string };
  event.waitUntil(
    (async () => {
      // An open tab of the calendar comes to the front instead of a new one, and
      // reloads: it may still show the door locked.
      const tabs = await worker.clients.matchAll({ type: "window" });
      const tab = tabs.find(
        (client) => new URL(client.url).origin === worker.location.origin,
      );
      if (tab === undefined) {
        await worker.clients.openWindow(url);
        return;
      }
      const focused = await tab.focus();
      await focused.navigate(url);
    })(),
  );
});
