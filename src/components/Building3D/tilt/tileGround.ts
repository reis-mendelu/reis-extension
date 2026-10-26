import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import type { Projector } from '../projection';

// The same tiles and the same filter as the Leaflet layer (mapLayers.ts), so
// the ground under the tilted camera is the picture the flat map just showed.
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const TILE_FILTER = 'grayscale(1) brightness(1.06) contrast(0.92)';
const MAX_NATIVE_ZOOM = 19;

/** Fractional tile coordinates of a point (Web Mercator, the slippy-map scheme). */
export function tileXY(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const φ = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * n,
  };
}

/** [lng, lat] of a tile corner (integer or not). */
export function tileCorner(x: number, y: number, z: number): [number, number] {
  const n = 2 ** z;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [(x / n) * 360 - 180, lat];
}

/** Draw a loaded tile through the Leaflet layer's CSS filter. */
function filtered(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.filter = TILE_FILTER;
    ctx.drawImage(img, 0, 0);
  }
  return canvas;
}

interface GroundInput {
  project: Projector;
  center: [number, number]; // [lng, lat]
  zoom: number;
  /** Tiles out from the centre tile, each way. */
  radius: number;
  y: number;
  onTile: () => void;
}

/**
 * A square of map tiles laid on the ground plane at height `y`, each placed by
 * its real corners in the local frame. Tiles fill in as they load; `onTile`
 * asks for a redraw, since the scene only draws when asked.
 */
export function buildTileGround({ project, center, zoom, radius, y, onTile }: GroundInput): {
  group: Group;
  /** Every tile loaded or failed — the handover waits for this, or it flashes grey. */
  loaded: Promise<void>;
} {
  const z = Math.min(Math.round(zoom), MAX_NATIVE_ZOOM);
  const c = tileXY(center[0], center[1], z);
  const group = new Group();
  const pending: Promise<void>[] = [];
  for (let tx = Math.floor(c.x) - radius; tx <= Math.floor(c.x) + radius; tx++) {
    for (let ty = Math.floor(c.y) - radius; ty <= Math.floor(c.y) + radius; ty++) {
      const [x0, z0] = project(tileCorner(tx, ty, z)); // north-west
      const [x1, z1] = project(tileCorner(tx + 1, ty + 1, z)); // south-east
      const geometry = new PlaneGeometry(x1 - x0, z1 - z0);
      geometry.rotateX(-Math.PI / 2); // face up; +v runs north → −z
      const material = new MeshBasicMaterial({ color: 0xeeeeee, toneMapped: false });
      const mesh = new Mesh(geometry, material);
      mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      group.add(mesh);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let settle = () => {};
      pending.push(new Promise<void>((resolve) => (settle = resolve)));
      img.onerror = () => settle();
      img.onload = () => {
        const texture = new CanvasTexture(filtered(img));
        texture.colorSpace = SRGBColorSpace;
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        onTile();
        settle();
      };
      img.src = TILE_URL(z, tx, ty);
    }
  }
  return { group, loaded: Promise.all(pending).then(() => undefined) };
}
