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
import { buildGraph, snapAnchors, unplacedPlaces } from './lib/pathGraph.mjs';
import { networkStrokes, walksFrom } from './lib/pathWalks.mjs';
import { clipToRegion } from './lib/osmClip.mjs';
import { campusPlaces, splitAnchors, KIND_OF_RANK, RANK } from './lib/campusPlaces.mjs';
import { corridorWays } from './lib/remoteCorridor.mjs';
import { joinAtAnchor } from './lib/osmCorridor.mjs';
import { exportGraph } from './lib/graphExport.mjs';
import { overpass } from './lib/overpass.mjs';
import { nodeKey } from './lib/pathGeo.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const BUILDINGS = read('../src/data/map/buildings.json');
const LANDMARKS = read('../src/data/map/landmarks.json').landmarks;
const POIS = read('../src/data/map/pois.json').features;
const REMOTE = read('../src/data/map/remotePlaces.json').places;

// The arboretum footpaths, hand-curated in remotePlaces.json, reach the campus
// at the arboretum gate. Folding them into the graph is what puts the garden's
// FAR gate — out at Generála Píky, by FRRMS — on the network, and it is the
// through-route students actually use between the campus and Černá Pole.
//
// Worth knowing what that buys and what it costs: the walks from that gate run
// nine to thirteen minutes THROUGH the garden, which is ticketed and shuts at
// dusk. reIS has no opening hours to check them against, so those walks are
// honest only while the garden is open. Kept deliberately, eyes open.
const GARDEN_ID = -101;
const ARBORETUM_GATE = 'Arboretum';
// The corridor must genuinely start at the gate. The two coordinates for it
// differ only in the decimals Overpass keeps and the curated file rounds away,
// which is well under a metre; 2 m is slack for that and nothing else.
const CORRIDOR_ANCHOR_M = 2;

// The campus, plus enough margin to keep the gates and the Zemědělská pavement
// that students actually arrive on. It stops well short of the arboretum, which
// has its own footpath network in remotePlaces.json.
const MARGIN_M = 50;
const [[s, w], [n, e]] = BUILDINGS.campus.bounds;
const dLat = MARGIN_M / 110540;
const dLon = MARGIN_M / (111320 * Math.cos((49.21 * Math.PI) / 180));
const REGION = { s: s - dLat, w: w - dLon, n: n + dLat, e: e + dLon };

/**
 * The off-campus places a student walks FROM, and the corridor of OSM footway
 * that connects each one to the campus network.
 *
 * A corridor is its OWN Overpass extract joined at a DECLARED anchor, rather
 * than a wider REGION. Widening REGION would re-clip the campus itself and
 * silently rewrite the 49 committed campus routes as a side effect of a feature
 * about somewhere else; a separate extract leaves them byte-identical and makes
 * each corridor reviewable on its own.
 *
 * `anchor` is the graph node the corridor is pinned to, by name. Declared, not
 * inferred: `corridorWays` rewrites the corridor endpoint nearest that node and
 * REFUSES a corridor that does not in fact start there, rather than stretching
 * to reach it. `after` says which pass the anchor exists in — the FRRMS gate is
 * itself only on the network once the garden corridor has been folded in.
 */
const CORRIDORS = [
  {
    name: 'FRRMS',
    anchor: 'Brána u FRRMS',
    after: 'garden',
    // The gate out at Generála Píky, and the faculty 250 m north of it.
    box: { s: 49.2152, w: 16.6118, n: 49.2192, e: 16.6168 },
  },
  {
    // The four JAK blocks collapse to ONE origin named for the place, because
    // four fans from four doors 60 m apart is four answers to one question.
    // (The collapse happens in campusPlaces' SHORT_LANDMARK map.)
    name: 'Koleje JAK',
    anchor: 'Brána Lesnická',
    after: 'campus',
    // The dormitories at 16.6297..16.6316 / 49.2152..49.2166, and the campus's
    // eastern gate 1.1 km west of them.
    box: { s: 49.2118, w: 16.6168, n: 49.2172, e: 16.6322 },
  },
];
/** Names in CORRIDORS are the landmarks that become RANK.origin. */
const ORIGINS = new Set(CORRIDORS.map((c) => c.name));
/**
 * How close an OSM corridor vertex must be to the anchor to BE that node.
 *
 * Centimetres, not metres. The gap being closed is the 2 cm between the
 * garden's curated gate and OSM's node for the same gate — see osmCorridor.mjs.
 * A metre-scale tolerance here would start merging genuinely separate paths.
 */
const CORRIDOR_JOIN_M = 1;

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

// Two places this close to each other are the same doorway under two names (a
// gate and the drive through it, a building and the café in it). Used twice:
// as the minimum gap between anchors, and as the length below which a route is
// not worth drawing.
const MIN_M = 25;

// Mirrors src/utils/walkTime.ts. Only the summary log uses it; kept in step so
// the build does not print minutes the app disagrees with.
const WALK_M_PER_MIN = 100;

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

/** The same filtering the campus ways get, over one corridor's own box. */
async function corridorGeometry(box) {
  const q = `[out:json][timeout:90];
(
  way["highway"~"^(footway|path|steps|pedestrian|living_street)$"](${box.s},${box.w},${box.n},${box.e});
  way["highway"="service"]["service"!="parking_aisle"](${box.s},${box.w},${box.n},${box.e});
);
out geom;`;
  const res = await overpass(q);
  return res.elements
    .filter((el) => el.type === 'way' && Array.isArray(el.geometry))
    .filter((el) => (el.tags ?? {}).access !== 'private' && (el.tags ?? {}).foot !== 'no')
    .sort((a, b) => a.id - b.id)
    .flatMap((way) => clipToRegion(way.geometry.map((p) => [p.lon, p.lat]), box));
}

// Two passes, because the corridor can only be pinned once the campus graph
// exists: the first builds the campus alone and asks it where the arboretum
// gate actually landed, the second re-builds it with the corridor hanging off
// that node. Everything downstream sees one network.
const campusGraph = buildGraph(ways);
const PLACES = campusPlaces(BUILDINGS, LANDMARKS, POIS, ORIGINS);
const gateKey = [...snapAnchors(campusGraph, PLACES, 35, { minSeparationM: MIN_M })].find(
  ([, name]) => name === ARBORETUM_GATE
)?.[0];
if (!gateKey) {
  console.error(`${ARBORETUM_GATE} is not on the campus network, so the corridor cannot join it.`);
  console.error('Refusing to write.');
  process.exit(1);
}
const GARDEN = REMOTE.find((p) => p.id === GARDEN_ID);
const corridor = corridorWays(GARDEN.paths, campusGraph.nodes.get(gateKey), CORRIDOR_ANCHOR_M);

// The garden folded in; now the corridors that hang off IT. The FRRMS gate is
// itself only a node because the garden corridor put it there, so its corridor
// can only be pinned once this graph exists — the same two-pass reason, one
// level further out.
const gardenGraph = buildGraph([...ways, ...corridor]);
const corridorWaysAll = [];
for (const spec of CORRIDORS) {
  const base = spec.after === 'garden' ? gardenGraph : campusGraph;
  const anchorKey = [...snapAnchors(base, PLACES, 35, { minSeparationM: MIN_M })].find(
    ([, name]) => name === spec.anchor
  )?.[0];
  if (!anchorKey) {
    console.error(`${spec.name}: its anchor "${spec.anchor}" is not on the network.`);
    console.error('Refusing to write.');
    process.exit(1);
  }
  const geom = await corridorGeometry(spec.box);
  if (!geom.length) {
    console.error(`${spec.name}: Overpass returned no walkable way in its box.`);
    process.exit(1);
  }
  const pinned = joinAtAnchor(geom, base.nodes.get(anchorKey), CORRIDOR_JOIN_M);
  corridorWaysAll.push(...pinned);
  console.log(`${spec.name}: ${pinned.length} corridor ways pinned at ${spec.anchor}`);
}

const graph = buildGraph([...ways, ...corridor, ...corridorWaysAll]);
const anchors = snapAnchors(graph, PLACES, 35, { minSeparationM: MIN_M });

// The lettered buildings and the gate everyone walks through are what the layer
// exists for. If OSM shifts a node, or a rename changes which of two places
// wins a contested one, a place can quietly stop being on the network and the
// map just... has fewer routes. That is the kind of thing nobody notices for a
// semester, so the run fails instead.
// Every gate must reach every building. Checking that each NAME merely appears
// somewhere was not the promise the map makes: if OSM shifts and one gate loses
// one building while both stay connected to everything else, a student standing
// at that gate is shown nothing and the old check passed happily.

// Not an error — these are genuinely off-campus (Menza koleje is 955 m away,
// Tauferovy 1.7 km) — but worth printing so a place that SHOULD be on the
// network and quietly is not gets noticed.
const offNetwork = unplacedPlaces(graph, PLACES, 35, { minSeparationM: MIN_M });
if (offNetwork.length) console.log(`not on the network: ${offNetwork.join(', ')}`);

// An ENTRANCE is where you arrive on foot: a gate, or the tram stop you get off
// at. A walk starts at one of those and ends at a lettered building — those are
// the two ends of the only question a campus map is really asked.
const rankByName = new Map();
for (const p of PLACES) rankByName.set(p.name, Math.min(rankByName.get(p.name) ?? 9, p.rank));
const { entranceNodes, buildingNodes } = splitAnchors(
  anchors,
  rankByName,
  new Set(BUILDINGS.buildings.map((b) => b.name))
);

// Every node the garden corridor contributed. An edge counts as "garden" only
// when BOTH ends came from the corridor: an edge with one end on the campus is
// the join AT the gate, which is public ground and always walkable.
const gardenKeys = new Set();
for (const way of corridor) for (const c of way.coords) gardenKeys.add(nodeKey(c));
const gateOf = (a, b) => (gardenKeys.has(a) && gardenKeys.has(b) ? 'garden' : null);
const routingGraph = exportGraph(graph, buildingNodes, gateOf);

/**
 * The fan origins, which are NOT every place the router can start from.
 *
 * `routes` is the precomputed place-to-place walk the entrance fan draws when a
 * student taps a gate. It predates the graph and is still the right thing for
 * that interaction — but it stores a full polyline per pair, and once the
 * off-campus corridors arrived it was carrying seven origins' worth of
 * cross-city geometry: 98 routes, 99.5 KB, more than the entire graph beside
 * it, describing walks the router can now derive on demand.
 *
 * So the fan keeps the campus entrances it always had, and the corridors live
 * in the graph alone. Nothing is lost: routing FROM FRRMS or the JAK
 * dormitories works because the GRAPH reaches them, which is what
 * `snapToGraph` needs, and "from where I am standing" is a better answer than
 * a fan from a dormitory door anyway.
 */
const inCampus = ([lon, lat]) =>
  lon >= REGION.w && lon <= REGION.e && lat >= REGION.s && lat <= REGION.n;
const fanOrigins = new Map(
  [...entranceNodes].filter(([key, name]) => {
    const rank = rankByName.get(name);
    // Every GATE, wherever it sits: the arboretum's far gate out at Generála
    // Píky is 300 m north of the campus box and has always been a fan origin.
    if (rank === RANK.gate) return true;
    // A tram stop only if you can walk onto the campus from it directly. The
    // corridors dragged in Merhautova, Provazníkova and three more, each a
    // kilometre out — a fan from those is a cross-city polyline, not a campus
    // walk.
    if (rank === RANK.stop) return inCampus(key.split(',').map(Number));
    // Never an off-campus origin. FRRMS and the JAK dormitories are reachable
    // because the GRAPH reaches them, which is all snapToGraph needs.
    return false;
  })
);

const routes = walksFrom(graph, fanOrigins, buildingNodes)
  .filter((r) => r.lengthM >= MIN_M)
  .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
  .map((r, i) => ({
    id: i + 1,
    from: r.from,
    to: r.to,
    lengthM: r.lengthM,
    coords: r.coords.map(([lon, lat]) => [round(lon), round(lat)]),
  }));

// Where each entrance actually sits, so the map can mark it without
// re-deriving it from walk endpoints. `kind` is what the UI reads to decide
// whether to label a place: a lettered building already names itself and must
// never get a second pill on top of its own letter, which is why splitAnchors
// keeps buildings out of here entirely.
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
const entrances = [...fanOrigins.entries()]
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

const gateNames = [...new Set([...fanOrigins.values()])].sort();
const hallNames = [...new Set([...buildingNodes.values()])].sort();
const have = new Set(routes.map((r) => `${r.from}→${r.to}`));
const missing = gateNames.flatMap((g) =>
  hallNames.filter((h) => !have.has(`${g}→${h}`)).map((h) => `${g} → ${h}`)
);
if (missing.length) {
  console.error(`The network does not connect ${missing.length} gate/building pair(s):`);
  for (const m of missing) console.error(`   ${m}`);
  console.error('A student standing at that gate would be shown nothing. Refusing to write.');
  process.exit(1);
}

writeFileSync(
  new URL('../src/data/map/campusPaths.json', import.meta.url),
  JSON.stringify(
    { source: 'OpenStreetMap (ODbL)', entrances, network, routes, graph: routingGraph },
    null,
    0
  ) + '\n'
);
console.log(
  `${ways.length} clipped ways → ${graph.nodes.size} nodes, ` +
    `${entrances.length} entrances × ${buildingNodes.size} buildings → ${routes.length} walks ` +
    `drawn as ${network.length} strokes over ${network.reduce((a, s) => a + s.length - 1, 0)} segments`
);
console.log(`entrances: ${entrances.map((p) => `${p.name} (${p.kind})`).join(', ')}`);
for (const r of routes)
  console.log(
    `  ${String(Math.max(1, Math.round(r.lengthM / WALK_M_PER_MIN))).padStart(2)} min  ${r.from} → ${r.to}`
  );
