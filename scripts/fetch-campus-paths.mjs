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
  unplacedPlaces,
  walksFrom,
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
// `rank` is how much a person navigates BY the place, and it settles which name
// keeps a spot when two of them are the same doorway: building E outranks the
// Akademická vinotéka inside it, so the route says "E".
const RANK = { building: 0, gate: 1, cafeteria: 2, stop: 3 };
const KIND_OF_RANK = ['building', 'gate', 'cafeteria', 'stop'];
function places() {
  const out = [];
  const push = (name, lon, lat, rank) => out.push({ name, lon, lat, rank });
  const ring = (name, coords, rank) => coords.forEach(([lon, lat]) => push(name, lon, lat, rank));
  for (const b of BUILDINGS.buildings) ring(b.name, b.outline.coordinates[0], RANK.building);
  for (const l of LANDMARKS) ring(shortLandmark(l.name), l.outline.coordinates[0], RANK.building);
  for (const f of POIS) {
    const { type, name } = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    // The gatehouse is the main gate under another name — as a second anchor
    // 8 m away it only splits that route in two.
    // Cafeterias are deliberately NOT anchors. "Budova O" sat in the middle of
    // the campus and answered nothing: you do not arrive there, and a walk that
    // ends at it is not a walk anyone plans.
    if (type === 'gate') push(shortPoi(name), lon, lat, RANK.gate);
    else if (type === 'transportation_stop') push(shortStop(name), lon, lat, RANK.stop);
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

// Two places this close to each other are the same doorway under two names (a
// gate and the drive through it, a building and the café in it). Used twice:
// as the minimum gap between anchors, and as the length below which a route is
// not worth drawing.
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
const PLACES = places();
const anchors = snapAnchors(graph, PLACES, 35, { minSeparationM: MIN_M });

// The lettered buildings and the gate everyone walks through are what the layer
// exists for. If OSM shifts a node, or a rename changes which of two places
// wins a contested one, a place can quietly stop being on the network and the
// map just... has fewer routes. That is the kind of thing nobody notices for a
// semester, so the run fails instead.
const MUST_REACH = ['A', 'B', 'C', 'E', 'M', 'Q', 'X', 'Hlavní brána'];

// Not an error — these are genuinely off-campus (Menza koleje is 955 m away,
// Tauferovy 1.7 km) — but worth printing so a place that SHOULD be on the
// network and quietly is not gets noticed.
const offNetwork = unplacedPlaces(graph, PLACES, 35, { minSeparationM: MIN_M });
if (offNetwork.length) console.log(`not on the network: ${offNetwork.join(', ')}`);

// An ENTRANCE is where you arrive on foot: a gate, or the tram stop you get off
// at. A walk starts at one of those and ends at a lettered building — those are
// the two ends of the only question a campus map is really asked.
const isBuilding = (name) => BUILDINGS.buildings.some((b) => b.name === name);
const entranceNodes = new Map([...anchors].filter(([, n]) => !isBuilding(n)));
const buildingNodes = new Map([...anchors].filter(([, n]) => isBuilding(n)));

const routes = walksFrom(graph, entranceNodes, buildingNodes)
  .filter((r) => r.lengthM >= MIN_M)
  .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
  .map((r, i) => ({
    id: i + 1,
    from: r.from,
    to: r.to,
    lengthM: r.lengthM,
    coords: r.coords.map(([lon, lat]) => [round(lon), round(lat)]),
  }));

// Where each place a route ends at actually sits, so the map can mark it
// without re-deriving it from route endpoints. `kind` is what the UI needs to
// decide whether to label it: a lettered building already names itself on the
// map and must not get a second pill on top of its own letter.
const rankByName = new Map();
for (const p of PLACES) rankByName.set(p.name, Math.min(rankByName.get(p.name) ?? 9, p.rank));
// Two views of the same thing. `network` is what gets DRAWN: every stretch of
// path exactly once, so the map is one clean set of lines rather than 46
// overlapping ones repainting each other. `routes` is what gets TAPPED: the
// place-to-place walks, which necessarily overlap.
const network = networkStrokes(routes).map((stroke) =>
  stroke.map(([lon, lat]) => [round(lon), round(lat)])
);

// Checked against the ROUTES, not the anchors: a place can hold a node and
// still end up with no route to it, which is how building E briefly vanished
// from the map while still being "on the network". If OSM shifts a node the run
// fails rather than quietly shipping a campus with fewer ways across it.
const reached = new Set(routes.flatMap((r) => [r.from, r.to]));

// Only the entrances are shipped as points. The buildings already draw their
// own letters, and the cafeteria in the middle of the campus was answering
// nothing at all.
const entrances = [...entranceNodes.entries()]
  .map(([k, name]) => {
    const [lon, lat] = k.split(',').map(Number);
    return {
      name,
      kind: KIND_OF_RANK[rankByName.get(name)] ?? 'other',
      lon: round(lon),
      lat: round(lat),
    };
  })
  .filter((p) => reached.has(p.name))
  .sort((a, b) => a.name.localeCompare(b.name));

const missing = MUST_REACH.filter((n) => !reached.has(n));
if (missing.length) {
  console.error(`No route reaches: ${missing.join(', ')}`);
  console.error('The campus path network would ship without them. Refusing to write.');
  process.exit(1);
}

writeFileSync(
  new URL('../src/data/map/campusPaths.json', import.meta.url),
  JSON.stringify({ source: 'OpenStreetMap (ODbL)', entrances, network, routes }, null, 0) + '\n'
);
console.log(
  `${ways.length} clipped ways → ${graph.nodes.size} nodes, ` +
    `${entrances.length} entrances × ${buildingNodes.size} buildings → ${routes.length} walks ` +
    `drawn as ${network.length} strokes over ${network.reduce((a, s) => a + s.length - 1, 0)} segments`
);
console.log(`entrances: ${entrances.map((p) => `${p.name} (${p.kind})`).join(', ')}`);
for (const r of routes)
  console.log(
    `  ${String(Math.max(1, Math.round(r.lengthM / 80))).padStart(2)} min  ${r.from} → ${r.to}`
  );
