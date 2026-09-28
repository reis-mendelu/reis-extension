/**
 * `?notify=prompt|granted|denied` on the dev webapp, and nothing anywhere
 * else — `import.meta.env.DEV` dead-code-strips the whole function out of
 * every shipped build, the way `devForcedTarget` (`src/mobile/eduroamNative.ts`)
 * and `devSociety` do.
 *
 * `readNotificationPermission` (`src/services/eventReminders/sync.ts`) checks
 * this first, before asking Capacitor anything. The dev webapp has no
 * `@capacitor/local-notifications` plugin behind it, so `readNotificationPermission`
 * would otherwise always answer `'unsupported'` there — the soft-ask card
 * (and this override) would be reachable only by patching this file by hand,
 * which is exactly the trap `devForcedTarget`'s own doc comment warns about
 * for eduroam.
 */
export function devNotifyOverride(): 'prompt' | 'granted' | 'denied' | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('notify');
  return v === 'prompt' || v === 'granted' || v === 'denied' ? v : null;
}
