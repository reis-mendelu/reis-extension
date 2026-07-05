// Dev-only, run once: sources footprints for the 4 off-campus MENDELU sites
// (arboretum, Lednice faculty, Žabčice farm, Křtiny château) from OpenStreetMap
// (Overpass) and writes src/data/map/remotePlaces.json. NOT part of the shipped
// bundle — the JSON output is committed instead.
//
// Usage: node scripts/fetch-remote-places.mjs
//
// Each site pins a hand-verified OSM way ID, so the geometry is unambiguous:
//  - single-building / single-area sites → one Polygon (arboretum garden,
//    Žabčice farmyard, Křtiny château).
//  - the Lednice faculty is a whole campus, so its `groundsWayId` polygon is used
//    as a spatial filter to collect ALL building footprints inside it → one
//    MultiPolygon drawn building-by-building like the main campus.

import { readFileSync, writeFileSync } from 'node:fs';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Site shapes:
//  - wayId          → one Polygon outline (a single areal / building)
//  - groundsWayId   → MultiPolygon of every building inside that grounds polygon
//  - keepAsArea     → also keep the grounds polygon itself as a faint `area`
//                     boundary behind the buildings (the arboretum garden)
const SITES = [
  { groundsWayId: 44368231, keepAsArea: true, id: -101, name: 'Botanická zahrada a arboretum MENDELU', shortName: 'Botanická zahrada a arboretum', url: 'https://arboretum.mendelu.cz/', address: 'Gen. Píky 827/2, Brno-Černá Pole' },
  { groundsWayId: 242749779, id: -102, name: 'Zahradnická fakulta – Lednice', shortName: 'Zahradnická fak. – Lednice', url: 'https://zf.mendelu.cz/', address: 'Valtická 337, Lednice' },
  { wayId: 835010329, id: -103, name: 'Školní zemědělský podnik Žabčice', shortName: 'ŠZP Žabčice', url: 'https://szp.mendelu.cz/', address: 'Žabčice 53' },
  { wayId: 61229872, id: -104, name: 'Školní lesní podnik Masarykův les Křtiny', shortName: 'ŠLP Křtiny', url: 'https://www.slpkrtiny.cz/', address: 'Křtiny 175 (Zámek Křtiny)' },
];

async function overpass(query, attempt = 0) {
  const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
  let res;
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 30000); // some mirrors hang — cap the wait
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        signal: ac.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'reIS-mendelu-remote-places-fetch/1.0 (https://github.com/reis-mendelu)',
        },
        body: 'data=' + encodeURIComponent(query),
      });
    } finally { clearTimeout(to); }
  } catch (e) {
    if (attempt < 8) { await new Promise((r) => setTimeout(r, 3000)); return overpass(query, attempt + 1); }
    throw e;
  }
  // 429 (rate limit) and 5xx (overloaded/timeout) are transient — back off and
  // rotate to the next mirror.
  if ((res.status === 429 || res.status >= 500) && attempt < 8) {
    const wait = 3000 * (attempt + 1);
    console.warn(`  HTTP ${res.status} from ${endpoint}, retrying in ${wait / 1000}s…`);
    await new Promise((r) => setTimeout(r, wait));
    return overpass(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return res.json();
}

const closeRing = (ring) => {
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0]);
  return ring;
};

// A single way → one closed ring.
async function fetchWay(wayId) {
  const json = await overpass(`[out:json][timeout:30];way(id:${wayId});out geom;`);
  const w = (json.elements || []).find((e) => e.type === 'way' && Array.isArray(e.geometry));
  if (!w) return null;
  return closeRing(w.geometry.map((g) => [g.lon, g.lat]));
}

// A grounds polygon → its boundary ring + every building ring inside it.
async function fetchBuildingsInGrounds(groundsWayId) {
  const g = await overpass(`[out:json][timeout:30];way(id:${groundsWayId});out geom;`);
  const gw = (g.elements || []).find((e) => e.type === 'way' && Array.isArray(e.geometry));
  if (!gw) return null;
  const boundary = closeRing(gw.geometry.map((p) => [p.lon, p.lat]));
  const poly = gw.geometry.map((p) => `${p.lat} ${p.lon}`).join(' ');
  await new Promise((r) => setTimeout(r, 1200));
  const b = await overpass(`[out:json][timeout:30];way[building](poly:"${poly}");out geom;`);
  const ways = (b.elements || []).filter((e) => e.type === 'way' && Array.isArray(e.geometry));
  return { boundary, rings: ways.map((w) => closeRing(w.geometry.map((p) => [p.lon, p.lat]))) };
}

const out = [];
for (const s of SITES) {
  const meta = { id: s.id, name: s.name, shortName: s.shortName, url: s.url, address: s.address };
  if (s.groundsWayId) {
    const res = await fetchBuildingsInGrounds(s.groundsWayId);
    if (!res || res.rings.length === 0) { console.warn(`MISS grounds ${s.groundsWayId} (${s.shortName}) — hand-check`); continue; }
    if (s.keepAsArea) meta.area = { type: 'Polygon', coordinates: [res.boundary] };
    out.push({ ...meta, outline: { type: 'MultiPolygon', coordinates: res.rings.map((r) => [r]) } });
    console.log(`OK ${s.shortName}: ${res.rings.length} buildings${s.keepAsArea ? ' + garden area' : ''}`);
  } else {
    const ring = await fetchWay(s.wayId);
    if (!ring) { console.warn(`MISS way ${s.wayId} (${s.shortName}) — hand-check`); continue; }
    out.push({ ...meta, outline: { type: 'Polygon', coordinates: [ring] } });
    console.log(`OK ${s.shortName}: ${ring.length} pts`);
  }
  await new Promise((r) => setTimeout(r, 1200)); // be polite to Overpass
}

// `paths` and `pois` (the arboretum footpath network + labelled points) are
// hand-curated and live ONLY in the committed JSON — this OSM fetch never
// produces them. Read the existing file and merge them back per-id, or every
// regeneration would silently drop them.
const target = new URL('../src/data/map/remotePlaces.json', import.meta.url);
const PRESERVE = ['paths', 'pois'];
let prevById = new Map();
try {
  const prev = JSON.parse(readFileSync(target, 'utf8'));
  prevById = new Map((prev.places || []).map((p) => [p.id, p]));
} catch { /* first run — nothing to preserve */ }
for (const place of out) {
  const prev = prevById.get(place.id);
  if (!prev) continue;
  for (const key of PRESERVE) {
    if (prev[key] !== undefined) {
      place[key] = prev[key];
      console.log(`  preserved hand-curated ${key} on ${place.shortName}`);
    }
  }
}
// NOTE: `outline`/`area` ARE regenerated from OSM here, so any manual footprint
// trimming (e.g. the arboretum kept only the greenhouse complex) must be
// re-applied by hand after a regeneration.
writeFileSync(target, JSON.stringify({ places: out }, null, 2) + '\n');
console.log(`Wrote ${out.length}/${SITES.length} remote-place footprints.`);
