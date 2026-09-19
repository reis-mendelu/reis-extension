// Dev-only, run on demand: sources the walking-path network of the Brno campus
// from OpenStreetMap (Overpass) and writes src/data/map/campusPaths.json. NOT
// part of the shipped bundle — the JSON output is committed instead, exactly
// like fetch-landmarks / fetch-remote-places.
//
// Usage: node scripts/fetch-campus-paths.mjs
//
// Why this script exists at all: OSM stores the campus footpaths as ~100 ways
// with a median length of 33 m and exactly ONE name between them. Drawn raw
// that is an anonymous mesh. mergeRoutes (scripts/lib/pathRoutes.mjs, unit
// tested) re-assembles it into continuous walks, and each walk is named after
// the campus place at either end — a description of the line that is drawn, not
// a routing claim.

import { writeFileSync, readFileSync } from 'node:fs';
import { clipToRegion, mergeRoutes, routeLengthM, labelRoute } from './lib/pathRoutes.mjs';
import { overpass } from './lib/overpass.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const BUILDINGS = read('../src/data/map/buildings.json');
const LANDMARKS = read('../src/data/map/landmarks.json').landmarks;
const POIS = read('../src/data/map/pois.json').features;

// The campus, plus enough margin to keep the gates and the Zemědělská pavement
// that students actually arrive on. 120 m reaches the Lesnická side gate (44 m
// past the north edge) and stops well short of the arboretum, which has its own
// footpath network in remotePlaces.json.
const MARGIN_M = 50;
const [[s, w], [n, e]] = BUILDINGS.campus.bounds;
const dLat = MARGIN_M / 110540;
const dLon = MARGIN_M / (111320 * Math.cos((49.21 * Math.PI) / 180));
const REGION = { s: s - dLat, w: w - dLon, n: n + dLat, e: e + dLon };

// Anything a person walks on INSIDE the campus.
//
// `service` is in the list on purpose, and it is the whole reason the layer is
// worth drawing. OSM has barely mapped the MENDELU campus as footways — the
// first cut of this script produced a ring of street pavements around an empty
// middle, because the ways between A, Q, X and M are tagged as service roads.
// On this campus those ARE the walkways: a shared surface with the odd delivery
// van, which is how every student crosses from the main gate to their building.
// `parking_aisle` stays out — that is a car park, not a route to anywhere.
// Cycleways stay out too: this layer is for someone on foot.
const QUERY = `[out:json][timeout:90];
(
  way["highway"~"^(footway|path|steps|pedestrian)$"](${REGION.s},${REGION.w},${REGION.n},${REGION.e});
  way["highway"="service"]["service"!="parking_aisle"](${REGION.s},${REGION.w},${REGION.n},${REGION.e});
);
out geom;`;

/** Places a route end can be named after, each as {name, lon, lat}. A polygon
 *  contributes one entry PER VERTEX so "near the place" means near its wall. */
function places() {
  const out = [];
  const push = (name, lon, lat) => out.push({ name, lon, lat });
  const ring = (name, coords) => coords.forEach(([lon, lat]) => push(name, lon, lat));
  for (const b of BUILDINGS.buildings) ring(b.name, b.outline.coordinates[0]);
  for (const l of LANDMARKS) ring(shortLandmark(l.name), l.outline.coordinates[0]);
  for (const f of POIS) {
    const { type, name } = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    if (type === 'gate' || type === 'gatehouse' || type === 'cafeteria')
      push(shortPoi(name), lon, lat);
    else if (type === 'transportation_stop') push(shortStop(name), lon, lat);
  }
  return out;
}
// "Zastávka Zemědělská (směr Halasovo náměstí)" is a timetable row, not a label
// on a map — which direction the tram leaves in tells a pedestrian nothing.
const shortStop = (name) =>
  name
    .replace(/^Zastávka\s+/i, '')
    .replace(/\s*\(směr[^)]*\)\s*$/i, '')
    .trim();
const shortPoi = (name) =>
  name
    .replace(/^Vrátnice areálu.*$/i, 'Vrátnice')
    .replace(/\.$/, '')
    .trim();
const shortLandmark = (name) => name.replace(/\s*\(FRRMS\)\s*$/, '').trim();

// A route this short with nothing recognisable at either end is a connector
// stub between two other paths — real, but nothing a student would ever tap.
const MIN_UNNAMED_M = 45;
// And below this nothing is worth drawing at all, named or not: a 5 m driveway
// apron picks up the label "B ↔ Zemědělská" and then sits on the map as a tap
// target that tells you what you could already see.
const MIN_M = 25;

const round = (v) => Number(v.toFixed(6)); // ~0.1 m; keeps the committed JSON small

const data = await overpass(QUERY);
const ways = data.elements
  .filter((el) => el.type === 'way' && Array.isArray(el.geometry))
  .map((el) => ({ id: el.id, geometry: el.geometry, tags: el.tags ?? {} }))
  // Private service yards behind the buildings are drawn in OSM but a student
  // cannot walk them.
  .filter((way) => way.tags.access !== 'private' && way.tags.foot !== 'no')
  .sort((a, b) => a.id - b.id) // deterministic input → deterministic JSON
  // `out geom` hands back each way in FULL, so a pavement that merely grazes the
  // campus arrives with kilometres of street attached. Clip first, merge second.
  .flatMap((way) =>
    clipToRegion(
      way.geometry.map((p) => [p.lon, p.lat]),
      REGION
    ).map((coords, i) => ({ id: way.id * 10 + i, coords }))
  );

const PLACES = places();
const routes = mergeRoutes(ways)
  .map((r) => {
    const { from, to } = labelRoute(r, PLACES, 35);
    return { from, to, lengthM: Math.round(routeLengthM(r)), coords: r.coords, wayIds: r.wayIds };
  })
  .filter((r) => r.lengthM >= MIN_M && (r.from || r.to || r.lengthM >= MIN_UNNAMED_M))
  .sort((a, b) => b.lengthM - a.lengthM)
  .map((r, i) => ({
    id: i + 1,
    from: r.from,
    to: r.to,
    lengthM: r.lengthM,
    coords: r.coords.map(([lon, lat]) => [round(lon), round(lat)]),
  }));

const named = routes.filter((r) => r.from && r.to).length;
writeFileSync(
  new URL('../src/data/map/campusPaths.json', import.meta.url),
  JSON.stringify({ source: 'OpenStreetMap (ODbL)', routes }, null, 0) + '\n'
);
console.log(
  `${ways.length} OSM ways → ${routes.length} routes (${named} named at both ends), ` +
    `${routes.reduce((a, r) => a + r.lengthM, 0)} m total`
);
for (const r of routes.slice(0, 20))
  console.log(`  ${String(r.lengthM).padStart(4)} m  ${r.from ?? '—'} ↔ ${r.to ?? '—'}`);
