import { getPlatform } from '../platform';
import { safeFilename } from './safeFilename';
import type { SaveDeps } from './saveDocument';

/**
 * Wires saveBlob to the real host. The Capacitor branch is imported lazily so
 * the extension bundle never pulls in @capacitor/* — it would bloat the build
 * and the plugins are meaningless outside the app.
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
