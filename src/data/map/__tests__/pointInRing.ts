/**
 * Ray casting, mirroring the selection the fetch script makes.
 *
 * Shared by the bundled-data tests: `mapData.test.ts` uses it to check that a
 * building centroid falls inside the campus, `gardenPlaces.test.ts` to check
 * that every place in the botanical garden is actually in the garden.
 */
export function pointInRing(point: number[], ring: number[][]): boolean {
  const px = point[0]!;
  const py = point[1]!;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
