import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * Whether the device says it has no connection right now, and follows it as it
 * drops and comes back. Only `navigator.onLine === false` counts: the browser
 * can only be sure of "no network at all", never of "the internet works".
 */
export function useDeviceOffline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine === false,
    () => false
  );
}
