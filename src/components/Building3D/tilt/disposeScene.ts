import type { Object3D } from 'three';

type Disposable = { dispose(): void; map?: { dispose(): void } | null };

/** Free every geometry, material and texture under `root` (materials may be arrays). */
export function disposeScene(root: Object3D) {
  root.traverse((o) => {
    const m = o as { geometry?: { dispose(): void }; material?: Disposable | Disposable[] };
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      mat.map?.dispose();
      mat.dispose();
    }
  });
}
