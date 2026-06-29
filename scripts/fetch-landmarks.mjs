// Dev-only, run once: sources building footprints for the 8 campus landmarks
// from OpenStreetMap (Overpass), and writes src/data/map/landmarks.json.
// NOT part of the shipped bundle — the JSON output is committed instead.
//
// Usage: node scripts/fetch-landmarks.mjs
//
// For each landmark point we ask Overpass for building ways within 40 m and
// pick the footprint whose centroid is nearest the point. Misses are logged
// loudly so they can be hand-checked rather than silently shipping a wrong
// polygon (mirrors the project's "needs real evidence" rule for parsers).

import { writeFileSync } from 'node:fs';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

// id, name, type, url, phone, email, [lon, lat] — copied from pois.json.
const LANDMARKS = [
  { id: 1569, name: 'Koleje JAK Blok A', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.630584, lat: 49.216233 },
  { id: 1585, name: 'Koleje JAK Blok B', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.630844, lat: 49.215418 },
  { id: 1611, name: 'Koleje JAK Blok C', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.631388, lat: 49.216166 },
  { id: 1582, name: 'Koleje JAK Blok D', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27982-koleje-jak', phone: '+420 545 128 340', email: 'skm.koleje.jak@mendelu.cz', lon: 16.630004, lat: 49.215601 },
  { id: 1588, name: 'Tauferovy koleje', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27988-tauferovy-koleje', phone: '+420 541 422 051', email: 'jitka.chebenova@mendelu.cz', lon: 16.588826, lat: 49.214599 },
  { id: 1616, name: 'Kolej Akademie', type: 'dormitory', url: 'http://skm.mendelu.cz/ubytovani/ubytovaci-zarizeni/27987-kolej-akademie', phone: '+420 545 136 117', email: 'skm.koleje.akademie@mendelu.cz', lon: 16.614198, lat: 49.218173 },
  { id: 1587, name: 'Fakulta regionálního rozvoje a mezinárodních studií (FRRMS)', type: 'building', url: 'http://frrms.mendelu.cz', phone: '+420 545 136 306', email: 'info.frrms@mendelu.cz', lon: 16.614118, lat: 49.218161 },
  { id: 1623, name: 'Centrum sportovních aktivit MENDELU', type: 'building', url: 'http://csa.mendelu.cz', phone: '+420 541 212 698', email: 'jakub.havel@mendelu.cz', lon: 16.588579, lat: 49.21517 },
];

const ringCentroid = (ring) => {
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
};
const dist2 = (aLon, aLat, bLon, bLat) => (aLon - bLon) ** 2 + (aLat - bLat) ** 2;

async function fetchFootprint(lm) {
  const q = `[out:json][timeout:25];way[building](around:40,${lm.lat},${lm.lon});out geom;`;
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'reIS-mendelu-landmark-fetch/1.0 (https://github.com/reis-mendelu)',
    },
    body: 'data=' + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status} for ${lm.id}`);
  const json = await res.json();
  const ways = (json.elements || []).filter((e) => e.type === 'way' && Array.isArray(e.geometry));
  if (ways.length === 0) { console.warn(`MISS: no building way near ${lm.id} ${lm.name} — hand-check`); return null; }
  let best = null, bestD = Infinity;
  for (const w of ways) {
    const ring = w.geometry.map((g) => [g.lon, g.lat]);
    const [clon, clat] = ringCentroid(ring);
    const d = dist2(clon, clat, lm.lon, lm.lat);
    if (d < bestD) { bestD = d; best = ring; }
  }
  // Ensure the ring is closed.
  if (best && (best[0][0] !== best[best.length - 1][0] || best[0][1] !== best[best.length - 1][1])) best.push(best[0]);
  return best;
}

const out = [];
for (const lm of LANDMARKS) {
  let ring = null;
  try { ring = await fetchFootprint(lm); } catch (e) { console.warn(`ERROR ${lm.id}: ${e.message}`); }
  if (!ring) { console.warn(`SKIPPED ${lm.id} ${lm.name} — no footprint, fill in by hand`); continue; }
  out.push({ id: lm.id, name: lm.name, type: lm.type, url: lm.url, phone: lm.phone, email: lm.email, outline: { type: 'Polygon', coordinates: [ring] } });
  await new Promise((r) => setTimeout(r, 1200)); // be polite to Overpass
}

writeFileSync(new URL('../src/data/map/landmarks.json', import.meta.url), JSON.stringify({ landmarks: out }, null, 2) + '\n');
console.log(`Wrote ${out.length}/${LANDMARKS.length} landmark footprints. Verify any MISS/SKIPPED above.`);
