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
  /**
   * Credentials, kept apart from `storage` because the guarantee differs by
   * host and `storage` cannot offer this one: on Capacitor it is Preferences,
   * i.e. SharedPreferences/UserDefaults in the clear. Here the Capacitor host
   * encrypts under a key held in the Android Keystore.
   *
   * The extension deliberately reuses chrome.storage.local: it has no Keystore,
   * and its threat model is the browser profile rather than a lost handset.
   * The dev webapp is in-memory, like the rest of its storage.
   *
   * Only `tokenStore` should touch this. It exists for UISAuth, which
   * authenticates as the student on its own and never rotates.
   */
  secureStorage: PlatformStorage;
  /** Resolve a bundled asset to a loadable URL. */
  getAssetUrl(path: string): string;
}
