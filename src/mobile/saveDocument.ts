export interface SaveDeps {
  kind: 'extension' | 'capacitor' | 'web';
  anchorSave(blob: Blob, filename: string): void;
  nativeSave(blob: Blob, filename: string): Promise<string>;
  assertExists(uri: string): Promise<boolean>;
}

/**
 * Measured on device: on Android, `a.download` + `a.click()` on a blob: URL
 * saves NOTHING and throws NOTHING — the WebView's DownloadListener is never
 * invoked for blob: URLs. iOS WKWebView does not support a[download] either.
 *
 * A silent no-op is the failure mode that ships, so the native path asserts the
 * file exists afterwards and throws if it does not. Do not remove that check to
 * make a test pass.
 */
export async function saveBlob(blob: Blob, filename: string, deps: SaveDeps): Promise<void> {
  if (deps.kind !== 'capacitor') {
    deps.anchorSave(blob, filename);
    return;
  }
  const uri = await deps.nativeSave(blob, filename);
  if (!(await deps.assertExists(uri))) {
    throw new Error(`Document was not saved: ${filename}`);
  }
}
