import { createExtensionPlatform } from './extensionPlatform';
import type { ReisPlatform } from './types';

let current: ReisPlatform | null = null;

/**
 * Installed once at the entry point, before the React root renders. Reading it
 * before installation is a bug in boot order, not a condition to handle — hence
 * the throw rather than a silent fallback.
 */
export function setPlatform(p: ReisPlatform): void {
  current = p;
}

export function getPlatform(): ReisPlatform {
  if (current) return current;

  // The extension is the INCUMBENT host. Code shared with it (documentDownloader
  // in the content script, for example) must not start requiring a new boot
  // step, because one missed entry point — content, webiskam, background, both
  // iframe roots — becomes a production crash rather than a test failure.
  // So when a real extension runtime is visible, install that host implicitly.
  //
  // Capacitor and the dev webapp have no `chrome.runtime.id`, so a forgotten
  // setPlatform() there still fails loudly. That asymmetry is deliberate: be
  // forgiving to the host that already works, strict with the ones being added.
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    current = createExtensionPlatform();
    return current;
  }

  throw new Error(
    'reIS: no platform installed — call setPlatform() at the entry point before rendering',
  );
}

/** Test-only escape hatch; never call from app code. */
export function __resetPlatformForTests(): void {
  current = null;
}
