import { registerSW } from 'virtual:pwa-register';

type UpdateCallback = (hasUpdate: boolean) => void;

let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | undefined = undefined;
const updateListeners = new Set<UpdateCallback>();
let isUpdateReady = false;

// Initialize Service Worker registration with auto-update monitoring
export function initPWAUpdates() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Development must not install a worker or reload on controller changes.
  // Remove only this app's worker at the current scope, preserving journal data.
  if (import.meta.env.DEV) {
    const scope = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    void navigator.serviceWorker.getRegistrations().then(async registrations => {
      for (const registration of registrations) {
        const worker = registration.active || registration.waiting || registration.installing;
        const script = worker && new URL(worker.scriptURL);
        if (registration.scope === scope && script && /\/(?:sw|dev-sw)\.js$/.test(script.pathname)) {
          await registration.unregister();
        }
      }
    }).catch(error => console.warn('[PWA] Development worker cleanup failed:', error));
    return;
  }

  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New update ready for activation.');
      isUpdateReady = true;
      notifyListeners(true);
    },
    onOfflineReady() {
      console.log('[PWA] App precached and ready to work fully offline.');
    },
    onRegistered(registration) {
      if (!registration) return;
      swRegistration = registration;
      console.log('[PWA] Service Worker registered successfully.');

      // Check immediately for new updates upon app boot
      registration.update().catch((e) => console.warn('[PWA] Initial update check failed:', e));

      // Periodic check for new published versions every 30 seconds
      const intervalId = setInterval(() => {
        if (navigator.onLine) {
          registration.update().catch(() => {});
        }
      }, 30 * 1000);

      // Check for updates when user switches back to the app window/tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Check for updates when window gains focus
      window.addEventListener('focus', () => {
        if (navigator.onLine) {
          registration.update().catch(() => {});
        }
      });

      // Check for updates as soon as connectivity resumes
      window.addEventListener('online', () => {
        registration.update().catch(() => {});
      });

      // Clean up if window unloads
      window.addEventListener('beforeunload', () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      });
    },
    onRegisterError(error) {
      console.error('[PWA] Registration error:', error);
    },
  });

  // When a new service worker takes over, reload to apply new assets
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('[PWA] Controller changed, activating new build...');
    window.location.reload();
  });
}

function notifyListeners(hasUpdate: boolean) {
  updateListeners.forEach((cb) => cb(hasUpdate));
}

export function subscribeToAppUpdates(callback: UpdateCallback): () => void {
  updateListeners.add(callback);
  if (isUpdateReady) {
    callback(true);
  }
  return () => {
    updateListeners.delete(callback);
  };
}

export async function manualCheckForUpdate(): Promise<{ hasUpdate: boolean; message: string }> {
  if (!navigator.onLine) {
    return { hasUpdate: false, message: 'You are currently offline. Connect to check for published updates.' };
  }

  if (!swRegistration && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) swRegistration = reg;
    } catch {
      // ignore
    }
  }

  if (!swRegistration) {
    return { hasUpdate: false, message: 'App is up to date or running in web preview.' };
  }

  try {
    const prevInstalling = swRegistration.installing || swRegistration.waiting;
    await swRegistration.update();
    const newInstalling = swRegistration.installing || swRegistration.waiting;

    if (swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      isUpdateReady = true;
      notifyListeners(true);
      return { hasUpdate: true, message: 'New published release found and activated! Refreshing...' };
    }

    if (newInstalling && newInstalling !== prevInstalling) {
      isUpdateReady = true;
      notifyListeners(true);
      return { hasUpdate: true, message: 'New published update detected and downloading!' };
    }

    if (isUpdateReady) {
      return { hasUpdate: true, message: 'New published update is ready to install.' };
    }

    return { hasUpdate: false, message: 'You are running the latest published version of FeXecutioner OS.' };
  } catch (err) {
    console.error('Manual update check error:', err);
    return { hasUpdate: false, message: 'Unable to check for updates at this moment.' };
  }
}

export function applyPublishedUpdate() {
  if (updateSWFn) {
    updateSWFn(true);
  } else {
    window.location.reload();
  }
}
