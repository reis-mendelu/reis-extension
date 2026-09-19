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
export const RANK = { building: 0, gate: 1, cafeteria: 2, stop: 3 };
export const KIND_OF_RANK = ['building', 'gate', 'cafeteria', 'stop'];

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
};
const shortPoi = (name) => {
  const n = name.replace(/\.$/, '').trim();
  return SHORT[n] ?? n;
};
const shortLandmark = (name) => name.replace(/\s*\(FRRMS\)\s*$/, '').trim();

/**
 * Every candidate place, as {name, lon, lat, rank}.
 *
 * A polygon contributes one entry PER VERTEX so that "near the place" means
 * near its wall rather than near its centre; snapAnchors collapses each name
 * back to a single node.
 */
export function campusPlaces(buildings, landmarks, pois) {
  const out = [];
  const push = (name, lon, lat, rank) => out.push({ name, lon, lat, rank });
  const ring = (name, coords, rank) => coords.forEach(([lon, lat]) => push(name, lon, lat, rank));
  for (const b of buildings.buildings) ring(b.name, b.outline.coordinates[0], RANK.building);
  for (const l of landmarks) ring(shortLandmark(l.name), l.outline.coordinates[0], RANK.building);
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
