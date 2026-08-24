import type { Language } from '../store/types';

/**
 * The active language, readable synchronously without touching the store.
 *
 * It exists for one caller shape: code that runs from a catch block and needs
 * `translate`, but cannot import `useAppStore` because the store's own slices
 * import it back. `demoToast` is the case that forced it — slice → reportError
 * → demoToast → useAppStore → slice is a cycle that leaves the store undefined
 * at module evaluation, and the obvious escape (a dynamic import) only moved
 * the problem: the toast then landed after the caller had finished, which in
 * tests means after the environment was torn down.
 *
 * `src/store/types` is a type-only import, so nothing is pulled in at runtime
 * and the cycle stays broken. The i18n slice is the only writer.
 */
let current: Language = 'cz';

export function setCurrentLanguage(language: Language): void {
  current = language;
}

export function getCurrentLanguage(): Language {
  return current;
}
