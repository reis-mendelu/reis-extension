import { getPlatform } from '../platform';

/**
 * Which build the student is actually running, and which version of it.
 *
 * Both answers used to be guessed at each call site: telemetry read the
 * extension manifest and fell back to `0.0.0`, and the feedback form carried a
 * hand-edited `'4.0.0'` string. Off the extension — the whole phone app — the
 * first is unavailable and the second was two majors stale, so every report
 * from a phone was labelled with a version that never shipped.
 */

// Injected by the Capacitor and dev-webapp Vite builds. Declared rather than
// imported so the WXT build, which never defines it, still type-checks; the
// `typeof` guard is what makes the undefined case safe at runtime.
declare const __REIS_APP_VERSION__: string | undefined;

export function getAppVersion(): string {
  try {
    const fromManifest = chrome?.runtime?.getManifest?.().version;
    if (fromManifest) return fromManifest;
  } catch {
    // Not an extension, or an orphaned context — fall through.
  }
  return typeof __REIS_APP_VERSION__ === 'string' ? __REIS_APP_VERSION__ : '0.0.0';
}

/**
 * The host, for reports that need to say where they came from. A user-agent
 * check cannot answer this: the Android WebView reports itself as Chrome and
 * the iOS one as Safari, so app reports are indistinguishable from desktop
 * ones without asking the platform directly.
 *
 * `getPlatform()` throws when no host has been installed — a boot-order bug —
 * and neither telemetry nor a feedback form may be the thing that raises it.
 */
export function getHostLabel(): 'app' | 'extension' | 'web' {
  try {
    const kind = getPlatform().kind;
    if (kind === 'capacitor') return 'app';
    if (kind === 'extension') return 'extension';
    return 'web';
  } catch {
    return 'web';
  }
}
