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
  if (!current) {
    throw new Error(
      'reIS: no platform installed — call setPlatform() at the entry point before rendering',
    );
  }
  return current;
}

/** Test-only escape hatch; never call from app code. */
export function __resetPlatformForTests(): void {
  current = null;
}
