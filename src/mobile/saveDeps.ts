import { getPlatform } from '../platform';
import { safeFilename } from './safeFilename';
import type { SaveDeps } from './saveDocument';

/**
 * Wires saveBlob to the real host. The Capacitor branch is imported lazily, so
 * THIS module adds no plugin weight to a non-Capacitor build — the plugins are
 * meaningless outside the app.
 *
 * That is a claim about this file only. It previously read "the extension
 * bundle never pulls in @capacitor/*", which is not true and misled a later
 * reader into thinking any lazy import is free.
 *
 * Lazy means NOT EXECUTED, not NOT SHIPPED. WXT bundles the content script as a
 * single file and the extension's main chunk comes out as one 2.7 MB module too,
 * so Rollup inlines these `import()`s instead of splitting them out. Both
 * `.output/chrome-mv3/chunks/main-*.js` and `content-scripts/content.js`
 * therefore contain Capacitor runtime — grep either for `registerPlugin`. The
 * modules carrying it are `platform/secureStore.ts`, `mobile/openIsFile.ts` and
 * `mobile/eduroamNative.ts`; none is statically reachable from the entry, which
 * is exactly why the weight is easy to miss.
 *
 * So being lazy here buys deferred evaluation, which is real and worth keeping.
 * It does not buy a smaller download.
 */
export function buildSaveDeps(): SaveDeps {
  return {
    kind: getPlatform().kind,

    anchorSave(blob, filename) {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    },

    async nativeSave(blob, filename) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await blobToBase64(blob);
      // `path` is resolved relative to the directory, and `recursive` creates
      // whatever it names — so an IS-supplied name must be one segment only.
      const { uri } = await Filesystem.writeFile({
        path: safeFilename(filename),
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      return uri;
    },

    async assertExists(uri) {
      const { Filesystem } = await import('@capacitor/filesystem');
      try {
        const stat = await Filesystem.stat({ path: uri });
        return stat.size > 0;
      } catch {
        return false;
      }
    },
  };
}

/** Filesystem.writeFile takes base64, not a Blob. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the "data:<mime>;base64," prefix that readAsDataURL adds.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}
