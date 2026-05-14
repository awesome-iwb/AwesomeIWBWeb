import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
    if (!registration) return;
    // Poll for updates so users leave stale SW/assets quickly after deploy.
    window.setInterval(() => {
      void registration.update();
    }, 60_000);
  },
});
