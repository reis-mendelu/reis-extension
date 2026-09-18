/**
 * Turning OpenStreetMap multipolygon members into usable rings.
 *
 * Split out of `fetch-remote-places.mjs` because the ring assembly is the part
 * that can be quietly wrong: a relation's outer boundary is frequently NOT one
 * closed way but several open ways that have to be walked end-to-end. Closing
 * each member on its own — which is what this code used to do — invents an edge
 * across the gap and yields several bogus rings instead of one real one. The
 * Panská lícha relation happens to carry two already-closed ways, so nothing
 * caught it; the next relation would not be so kind.
 */

/** Same coordinate, within floating-point noise of the ~1e-7° OSM grid. */
const samePoint = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

const isClosed = (ring) => ring.length > 2 && samePoint(ring[0], ring[ring.length - 1]);

/** Close a ring that is complete but not explicitly repeated at the end. */
export const closeRing = (ring) => (isClosed(ring) ? ring : [...ring, ring[0]]);

/**
 * Walk open ways end-to-end into closed rings.
 *
 * Takes each way's coordinates and joins on shared endpoints, in either
 * direction — OSM imposes no winding or ordering on members. A group of ways
 * that never closes is DROPPED with a warning rather than force-closed: a
 * fabricated edge produces a plausible-looking polygon with a wrong boundary,
 * and a wrong boundary silently moves the site's centre and bounds.
 */
export function assembleOuterRings(ways, warn = console.warn) {
  const pool = ways.filter((w) => Array.isArray(w) && w.length >= 2).map((w) => [...w]);
  const rings = [];

  while (pool.length > 0) {
    let current = pool.shift();

    while (!isClosed(current)) {
      const head = current[0];
      const tail = current[current.length - 1];
      const i = pool.findIndex(
        (w) =>
          samePoint(tail, w[0]) ||
          samePoint(tail, w[w.length - 1]) ||
          samePoint(head, w[w.length - 1]) ||
          samePoint(head, w[0])
      );
      if (i === -1) break; // nothing left that can extend this chain

      const [next] = pool.splice(i, 1);
      if (samePoint(tail, next[0])) current = current.concat(next.slice(1));
      else if (samePoint(tail, next[next.length - 1]))
        current = current.concat([...next].reverse().slice(1));
      else if (samePoint(head, next[next.length - 1])) current = next.slice(0, -1).concat(current);
      else current = [...next].reverse().slice(0, -1).concat(current);
    }

    if (isClosed(current)) rings.push(current);
    else warn(`  open ring of ${current.length} pts could not be closed — skipped`);
  }

  return rings;
}

/** Mean of a ring's vertices. */
export const ringCentroid = (ring) => {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring) {
    x += lon;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
};

/** Ray casting — is this point inside the ring? */
export const pointInRing = ([px, py], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const ringContaining = (rings, point) => rings.find((r) => pointInRing(point, r)) ?? null;

/** Shoelace area, used only to break a tie when no ring encloses the building. */
export const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
};

export const largestRing = (rings) =>
  rings.reduce((best, r) => (ringArea(r) > ringArea(best) ? r : best), rings[0]);
