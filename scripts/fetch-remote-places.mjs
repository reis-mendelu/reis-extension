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
//  - Panská lícha's areal is a multipolygon RELATION, not a way, so it pins
//    `areaRelationId` for the faint boundary and `wayId` for the one building a
//    student actually walks into (the riding hall).

import { readFileSync, writeFileSync } from 'node:fs';
import {
  assembleOuterRings,
  closeRing,
  largestRing,
  ringCentroid,
  ringContaining,
} from './lib/osmRings.mjs';
import { overpass } from './lib/overpass.mjs';

// Site shapes:
//  - wayId          → one Polygon outline (a single areal / building)
//  - groundsWayId   → MultiPolygon of every building inside that grounds polygon
//  - keepAsArea     → also keep the grounds polygon itself as a faint `area`
//                     boundary behind the buildings (the arboretum garden)
//  - areaRelationId → faint `area` boundary taken from a multipolygon relation's
//                     outer rings, for an areal OSM maps as a relation
const SITES = [
  {
    groundsWayId: 44368231,
    keepAsArea: true,
    id: -101,
    name: 'Botanická zahrada a arboretum MENDELU',
    shortName: 'Botanická zahrada a arboretum',
    url: 'https://arboretum.mendelu.cz/',
    address: 'Gen. Píky 827/2, Brno-Černá Pole',
  },
  {
    groundsWayId: 242749779,
    id: -102,
    name: 'Zahradnická fakulta – Lednice',
    shortName: 'Zahradnická fak. – Lednice',
    url: 'https://zf.mendelu.cz/',
    address: 'Valtická 337, Lednice',
  },
  {
    wayId: 835010329,
    id: -103,
    name: 'Školní zemědělský podnik Žabčice',
    shortName: 'ŠZP Žabčice',
    url: 'https://szp.mendelu.cz/',
    address: 'Žabčice 53',
  },
  {
    wayId: 61229872,
    id: -104,
    name: 'Školní lesní podnik Masarykův les Křtiny',
    shortName: 'ŠLP Křtiny',
    url: 'https://www.slpkrtiny.cz/',
    address: 'Křtiny 175 (Zámek Křtiny)',
  },
  // NOT a MENDELU site — a private equestrian centre (Hotel Panská lícha s.r.o.,
  // IČO 26927853) where combined-study practicals are held. It is on the map
  // because students have to get there; see the spec's 2026-09-18 revision.
  // way 44748596 is `building=riding_hall, sport=equestrian` inside relation
  // 6147619 (`leisure=horse_riding`) — the hall is the useful pin, the relation
  // is the context around it.
  {
    wayId: 44748596,
    areaRelationId: 6147619,
    id: -105,
    name: 'Panská lícha',
    shortName: 'Panská lícha',
    url: 'https://www.panskalicha.cz/',
    address: 'Panská lícha 632/6, Obřany, 614 00 Brno',
  },
];

// A single way → one closed ring.
async function fetchWay(wayId) {
  const json = await overpass(`[out:json][timeout:30];way(id:${wayId});out geom;`);
  const w = (json.elements || []).find((e) => e.type === 'way' && Array.isArray(e.geometry));
  if (!w) return null;
  return closeRing(w.geometry.map((g) => [g.lon, g.lat]));
}

// A multipolygon relation → its outer rings, for an areal OSM maps as a relation
// rather than a single closed way. Only the `outer` role bounds the site (an
// `inner` role would be a hole). Members are frequently OPEN ways that have to
// be walked end-to-end, so hand them to assembleOuterRings rather than closing
// each one where it happens to stop.
async function fetchRelationOuterRings(relationId) {
  const json = await overpass(`[out:json][timeout:30];rel(id:${relationId});out geom;`);
  const rel = (json.elements || []).find((e) => e.type === 'relation' && Array.isArray(e.members));
  if (!rel) return null;
  const ways = rel.members
    .filter((m) => m.type === 'way' && m.role === 'outer' && Array.isArray(m.geometry))
    .map((m) => m.geometry.map((g) => [g.lon, g.lat]));
  const rings = assembleOuterRings(ways);
  return rings.length > 0 ? rings : null;
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
    if (!res || res.rings.length === 0) {
      console.warn(`MISS grounds ${s.groundsWayId} (${s.shortName}) — hand-check`);
      continue;
    }
    if (s.keepAsArea) meta.area = { type: 'Polygon', coordinates: [res.boundary] };
    out.push({
      ...meta,
      outline: { type: 'MultiPolygon', coordinates: res.rings.map((r) => [r]) },
    });
    console.log(
      `OK ${s.shortName}: ${res.rings.length} buildings${s.keepAsArea ? ' + garden area' : ''}`
    );
  } else {
    const ring = await fetchWay(s.wayId);
    if (!ring) {
      console.warn(`MISS way ${s.wayId} (${s.shortName}) — hand-check`);
      continue;
    }
    if (s.areaRelationId) {
      await new Promise((r) => setTimeout(r, 1200));
      const rings = await fetchRelationOuterRings(s.areaRelationId);
      if (!rings) {
        console.warn(`MISS relation ${s.areaRelationId} (${s.shortName}) — hand-check`);
        continue;
      }
      // `RemotePlace.area` is a single Polygon, and remotePlaceExtent() reads
      // `area.coordinates[0]` as one ring — so a relation with several outer
      // rings has to be reduced to the ONE that matters. That is the ring
      // enclosing the building we drew, not merely the biggest: the site's
      // bounds and centre are computed from `area`, so picking a detached
      // parcel would frame the map on empty ground beside the hall.
      const chosen = ringContaining(rings, ringCentroid(ring)) ?? largestRing(rings);
      meta.area = { type: 'Polygon', coordinates: [chosen] };
      console.log(
        `  + areal boundary from relation ${s.areaRelationId}: ${rings.length} outer ring(s), kept ${chosen.length} pts`
      );
    }
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
} catch {
  /* first run — nothing to preserve */
}
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
