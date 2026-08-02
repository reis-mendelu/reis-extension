/**
 * The single seam between reIS app code and its host. Three hosts implement it:
 * the Chrome extension, the Capacitor app, and the dev webapp. Keeping it this
 * narrow is deliberate — every method here is a capability that genuinely
 * differs per host. Anything the same everywhere does not belong.
 */
export interface PlatformStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ReisPlatform {
  kind: 'extension' | 'capacitor' | 'web';
  /** Settings that survive restarts. Extension: chrome.storage.local. */
  storage: PlatformStorage;
  /** Resolve a bundled asset to a loadable URL. */
  getAssetUrl(path: string): string;
}
