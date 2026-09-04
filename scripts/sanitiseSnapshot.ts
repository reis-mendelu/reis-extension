/**
 * Removes other students' identities from a scraped snapshot before it is
 * uploaded anywhere.
 *
 * Everything in the snapshot is Dominik's own data except `classmates`, which
 * lists real people. Four of that entry's five fields identify someone:
 * `name`, `personId`, and both `photoUrl` and `messageUrl`, each of which
 * embeds the personId in a URL.
 *
 * Rows and groups are preserved so the UI is exercised identically — long-name
 * wrapping, row counts, an empty group.
 */

/** Every field a classmate entry is allowed to have. Anything else throws. */
const KNOWN_CLASSMATE_FIELDS = ['name', 'personId', 'photoUrl', 'messageUrl', 'studyInfo'] as const;

/** Dropped outright — each one re-identifies the person. */
const DROPPED_CLASSMATE_FIELDS = ['personId', 'photoUrl', 'messageUrl'] as const;

const FIRST_NAMES = ['Jan', 'Eva', 'Petr', 'Lucie', 'Tomas', 'Marie', 'Jakub', 'Tereza'];
const SURNAMES = ['Novak', 'Svobodova', 'Dvorak', 'Cerna', 'Prochazka', 'Kucerova', 'Vesely'];

/**
 * Deterministic from the group and position alone — never from the real name,
 * so the output carries nothing derived from the person it replaces, and two
 * runs of the same snapshot diff cleanly.
 */
function fakeName(group: string, index: number): string {
  let h = 0;
  for (const ch of group) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const seed = Math.abs(h + index * 7919);
  return `${SURNAMES[seed % SURNAMES.length]} ${FIRST_NAMES[(seed >> 3) % FIRST_NAMES.length]}`;
}

export function sanitiseSnapshot(raw: unknown): {
  data: Record<string, unknown>;
  report: string[];
} {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Snapshot is not an object — refusing to sanitise it.');
  }

  const data = { ...(raw as Record<string, unknown>) };
  const report: string[] = [];
  const classmates = data.classmates;

  if (classmates === undefined || classmates === null) {
    report.push('No classmates in this snapshot — nothing to sanitise.');
    return { data, report };
  }

  if (typeof classmates !== 'object' || Array.isArray(classmates)) {
    throw new Error(
      'Expected `classmates` to be an object keyed by subject code. Refusing to guess at an unfamiliar shape.'
    );
  }

  let rows = 0;
  const cleaned: Record<string, unknown[]> = {};

  for (const [group, entries] of Object.entries(classmates as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      throw new Error(`Expected classmates["${group}"] to be an array.`);
    }
    cleaned[group] = entries.map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`classmates["${group}"][${index}] is not an object.`);
      }
      const record = entry as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (!KNOWN_CLASSMATE_FIELDS.includes(key as (typeof KNOWN_CLASSMATE_FIELDS)[number])) {
          throw new Error(
            `Unrecognised classmate field "${key}" in classmates["${group}"][${index}]. ` +
              `Refusing to upload a field nobody has reviewed — add it to KNOWN_CLASSMATE_FIELDS ` +
              `in scripts/sanitiseSnapshot.ts once you have decided whether it identifies anyone.`
          );
        }
      }
      const out: Record<string, unknown> = { ...record, name: fakeName(group, index) };
      for (const key of DROPPED_CLASSMATE_FIELDS) delete out[key];
      rows += 1;
      return out;
    });
  }

  data.classmates = cleaned;
  report.push(
    `Renamed ${rows} classmate row(s) across ${Object.keys(cleaned).length} group(s); ` +
      `dropped ${DROPPED_CLASSMATE_FIELDS.join(', ')}.`
  );
  return { data, report };
}
