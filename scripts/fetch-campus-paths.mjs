// Dev-only, run on demand: sources the walking network of the Brno campus from
// OpenStreetMap (Overpass) and writes src/data/map/campusPaths.json. NOT part of
// the shipped bundle — the JSON output is committed instead, exactly like
// fetch-landmarks / fetch-remote-places.
//
// Usage: node scripts/fetch-campus-paths.mjs
//
// What comes out is ROUTES BETWEEN PLACES, not path fragments. OSM stores the
// campus as ~100 ways with a median length of 33 m and one name between them,
// so the ways are loaded into a graph and a route is the walk from one campus
// place to the next one you reach (scripts/lib/pathNetwork.mjs, unit tested).
// Every route therefore starts and ends somewhere a student would name, and
// walking from any place to any other is a matter of following routes end to
// end.

import { writeFileSync, readFileSync } from 'node:fs';
import {
  buildGraph,
  clipToRegion,
  connectingRoutes,
  networkStrokes,
  snapAnchors,
} from './lib/pathNetwork.mjs';
import { overpass } from './lib/overpass.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const BUILDINGS = read('../src/data/map/buildings.json');
const LANDMARKS = read('../src/data/map/landmarks.json').landmarks;
const POIS = read('../src/data/map/pois.json').features;

// The campus, plus enough margin to keep the gates and the Zemědělská pavement
// that students actually arrive on. It stops well short of the arboretum, which
// has its own footpath network in remotePlaces.json.
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

// Places a route is allowed to start or end at. A polygon contributes one entry
// PER VERTEX so "near the place" means near its wall rather than its centre;
// snapAnchors collapses each name back to a single node.
function places() {
  const out = [];
  const push = (name, lon, lat) => out.push({ name, lon, lat });
  const ring = (name, coords) => coords.forEach(([lon, lat]) => push(name, lon, lat));
  for (const b of BUILDINGS.buildings) ring(b.name, b.outline.coordinates[0]);
  for (const l of LANDMARKS) ring(shortLandmark(l.name), l.outline.coordinates[0]);
  for (const f of POIS) {
    const { type, name } = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    // The gatehouse is the main gate under another name — as a second anchor
    // 8 m away it only splits that route in two.
    if (type === 'gate' || type === 'cafeteria') push(shortPoi(name), lon, lat);
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
// A route's chip carries BOTH its ends, so a place's name has to survive being
// half of "X ↔ Y" on a 320 px phone. The IS names do not:
// "Pizzerie v budově O ↔ Vedlejší brána z ulice Lesnická" is 53 characters and
// ran off the screen. These are the names a student would actually say.
const SHORT = {
  'Vedlejší brána z ulice Lesnická': 'Brána Lesnická',
  'Vjezd pro automobily u budovy Q': 'Vjezd u Q',
  'Vstup do Arboreta z areálu': 'Arboretum',
  // The anchor is the doorway of building O, which is the thing you walk to;
  // the pizzeria is what happens to be behind it.
  'Pizzerie v budově O': 'Budova O',
  'Akademická vinotéka': 'Vinotéka',
};
const shortPoi = (name) => {
  const n = name.replace(/\.$/, '').trim();
  return SHORT[n] ?? n;
};
const shortLandmark = (name) => name.replace(/\s*\(FRRMS\)\s*$/, '').trim();

// Two places this close to each other are the same doorway under two names
// (a gate and the drive through it). The route between them is a line nobody
// needs to be shown.
const MIN_M = 25;

const round = (v) => Number(v.toFixed(6)); // ~0.1 m; keeps the committed JSON small

const data = await overpass(QUERY);
const ways = data.elements
  .filter((el) => el.type === 'way' && Array.isArray(el.geometry))
  // Private service yards behind the buildings are drawn in OSM but a student
  // cannot walk them.
  .filter((el) => (el.tags ?? {}).access !== 'private' && (el.tags ?? {}).foot !== 'no')
  .sort((a, b) => a.id - b.id) // deterministic input → deterministic JSON
  // `out geom` hands back each way in FULL, so a pavement that merely grazes the
  // campus arrives with kilometres of street attached. Clip before graphing.
  .flatMap((way) =>
    clipToRegion(
      way.geometry.map((p) => [p.lon, p.lat]),
      REGION
    ).map((coords) => ({ coords }))
  );

const graph = buildGraph(ways);
const anchors = snapAnchors(graph, places(), 35);
const routes = connectingRoutes(graph, anchors)
  .filter((r) => r.lengthM >= MIN_M)
  .sort((a, b) => b.lengthM - a.lengthM || a.from.localeCompare(b.from))
  .map((r, i) => ({
    id: i + 1,
    from: r.from,
    to: r.to,
    lengthM: r.lengthM,
    coords: r.coords.map(([lon, lat]) => [round(lon), round(lat)]),
  }));

// Two views of the same thing. `network` is what gets DRAWN: every stretch of
// path exactly once, so the map is one clean set of lines rather than 46
// overlapping ones repainting each other. `routes` is what gets TAPPED: the
// place-to-place walks, which necessarily overlap.
const network = networkStrokes(routes).map((stroke) =>
  stroke.map(([lon, lat]) => [round(lon), round(lat)])
);

writeFileSync(
  new URL('../src/data/map/campusPaths.json', import.meta.url),
  JSON.stringify({ source: 'OpenStreetMap (ODbL)', network, routes }, null, 0) + '\n'
);
const reached = new Set(routes.flatMap((r) => [r.from, r.to]));
console.log(
  `${ways.length} clipped ways → ${graph.nodes.size} nodes, ` +
    `${anchors.size} places on the network → ${routes.length} routes ` +
    `(${routes.reduce((a, r) => a + r.lengthM, 0)} m walked, overlapping) ` +
    `drawn as ${network.length} strokes over ${network.reduce((a, s) => a + s.length - 1, 0)} segments`
);
console.log(`places reached: ${[...reached].sort().join(', ')}`);
for (const r of routes) console.log(`  ${String(r.lengthM).padStart(4)} m  ${r.from} ↔ ${r.to}`);
