/**
 * Which places on the MENDELU campus a walk is allowed to start or end at, and
 * what they are called on a map.
 *
 * Split out of fetch-campus-paths so that script stays about WHICH data is
 * fetched and how it is assembled, rather than about the naming of Czech gates.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

// `rank` is how much a person navigates BY the place, and it settles which name
// keeps a spot when two of them are the same doorway: building E outranks the
// Akademická vinotéka inside it, so the walk says "E".
// `origin` is an off-campus place a student STARTS from — FRRMS, the JAK
// dormitories. It is admitted to the ENTRANCES, which plain landmarks
// deliberately are not: a landmark carries RANK.building so it beats a café for
// a contested doorway, and admitting it to the entrances would ship it with
// kind 'building' and give a lettered building a second pill on top of its own
// letter. An origin is not a lettered building, so it can have one.
//
// It outranks a stop so that "FRRMS" wins a node it shares with "Bieblova":
// a student navigates by the faculty, not by the tram stop beside it.
//
// KIND_OF_RANK is INDEXED BY RANK. The two are pinned to each other by a test
// in __tests__/campusPlaces.test.ts, because inserting a rank without inserting
// its kind in the same position relabels every entrance below it — a gate
// shipping as a cafeteria, with nothing to say so.
export const RANK = { building: 0, origin: 1, gate: 2, cafeteria: 3, stop: 4 };
export const KIND_OF_RANK = ['building', 'other', 'gate', 'cafeteria', 'stop'];

// "Zastávka Zemědělská (směr Halasovo náměstí)" is a timetable row, not a label
// on a map — which direction the tram leaves in tells a pedestrian nothing.
const shortStop = (name) =>
  name
    .replace(/^Zastávka\s+/i, '')
    .replace(/\s*\(směr[^)]*\)\s*$/i, '')
    .trim();

// A place's name has to survive being half of a label on a 320 px phone. The IS
// names do not: "Vedlejší brána z ulice Lesnická" alone is 31 characters. These
// are the names a student would actually say.
const SHORT = {
  'Vedlejší brána z ulice Lesnická': 'Brána Lesnická',
  'Vjezd pro automobily u budovy Q': 'Vjezd u Q',
  'Vstup do Arboreta z areálu': 'Arboretum',
  // The arboretum's far gate, out at Generála Píky. Named for where it puts
  // you rather than for what it is: "Vstup do Arboreta od FRRMS" is 26
  // characters and both arboretum gates would then start with the same word.
  'Vstup do Arboreta od FRRMS': 'Brána u FRRMS',
};
const shortPoi = (name) => {
  const n = name.replace(/\.$/, '').trim();
  return SHORT[n] ?? n;
};
// A landmark's name has to survive being half of a label on a 320 px phone,
// and the IS names do not: the FRRMS one is 54 characters. These are the names
// a student would actually say — and the four JAK blocks collapse to ONE, for
// the reason the corridor does: four fans from four doors 60 m apart is four
// answers to one question.
const SHORT_LANDMARK = {
  'Fakulta regionálního rozvoje a mezinárodních studií (FRRMS)': 'FRRMS',
  'Koleje JAK Blok A': 'Koleje JAK',
  'Koleje JAK Blok B': 'Koleje JAK',
  'Koleje JAK Blok C': 'Koleje JAK',
  'Koleje JAK Blok D': 'Koleje JAK',
};
const shortLandmark = (name) => {
  const n = name.trim();
  return SHORT_LANDMARK[n] ?? n.replace(/\s*\(FRRMS\)\s*$/, '').trim();
};

/**
 * Every candidate place, as {name, lon, lat, rank}.
 *
 * A polygon contributes one entry PER VERTEX so that "near the place" means
 * near its wall rather than near its centre; snapAnchors collapses each name
 * back to a single node.
 */
export function campusPlaces(buildings, landmarks, pois, origins = new Set()) {
  const out = [];
  const push = (name, lon, lat, rank) => out.push({ name, lon, lat, rank });
  const ring = (name, coords, rank) => coords.forEach(([lon, lat]) => push(name, lon, lat, rank));
  for (const b of buildings.buildings) ring(b.name, b.outline.coordinates[0], RANK.building);
  for (const l of landmarks) {
    const name = shortLandmark(l.name);
    // An off-campus ORIGIN is a place a student walks FROM, and it needs a rank
    // that reaches the entrances. Everything else stays RANK.building, which
    // wins a contested doorway and is excluded from both ends of a walk.
    ring(name, l.outline.coordinates[0], origins.has(name) ? RANK.origin : RANK.building);
  }
  for (const f of pois) {
    const { type, name } = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    // The gatehouse is the main gate under another name — as a second anchor
    // 8 m away it only splits that walk in two.
    //
    // Cafeterias are deliberately NOT anchors. "Budova O" sat in the middle of
    // the campus and answered nothing: you do not arrive there, and a walk that
    // ends at it is not a walk anyone plans.
    if (type === 'gate') push(shortPoi(name), lon, lat, RANK.gate);
    else if (type === 'transportation_stop') push(shortStop(name), lon, lat, RANK.stop);
  }
  return out;
}

/**
 * Splits the anchored places into the two ends of a walk.
 *
 * Gated on RANK, not on membership of buildings.json, and that distinction is
 * load-bearing. Landmarks (the dorms, FRRMS, the sports centre) are pushed with
 * RANK.building so that they beat a café for a contested node — but they are
 * not lettered campus buildings, so "not a building" was letting them fall
 * through into the ENTRANCES, where they would have shipped with
 * `kind: 'building'` and broken the rule the map relies on (a building draws
 * its own letter and must never also get a pill). Every landmark is off-network
 * today, so this was latent until OSM mapped a path within 35 m of one.
 *
 * A place that is neither a gate, a stop, nor a lettered building is simply not
 * an end of any walk.
 *
 * @param {Map<string,string>} anchors node key → place name
 * @param {Map<string,number>} rankByName
 * @param {Set<string>} buildingNames the lettered buildings the map draws
 */
export function splitAnchors(anchors, rankByName, buildingNames) {
  const entranceNodes = new Map();
  const buildingNodes = new Map();
  for (const [node, name] of anchors) {
    const rank = rankByName.get(name);
    if (buildingNames.has(name)) buildingNodes.set(node, name);
    else if (rank === RANK.gate || rank === RANK.stop || rank === RANK.origin)
      entranceNodes.set(node, name);
  }
  return { entranceNodes, buildingNodes };
}
