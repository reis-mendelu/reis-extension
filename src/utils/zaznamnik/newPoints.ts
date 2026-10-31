import type { PhArch, SubjectZaznamnik } from '../../types/zaznamnik';

/** One záznamník entry the teacher filled in or changed since the last sync. */
export interface NewPoint {
  /** The column header (průběžné hodnocení) or the test's name (výsledky testů). */
  label: string;
  /** The cell exactly as IS shows it ("9", "4,5", "započteno"), or "score/max" for a test. */
  value: string;
  /**
   * When the sync found it (set by services/sync, never by the diff). Two
   * attempts can both read "Test 1: 9/10"; this is what tells them apart.
   */
  at?: number;
}

// A sum column moves with every other cell; it is news only when nothing else is.
const TOTAL_COLUMN = /^(součet|celkem|suma|total|sum)$/i;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

const isEmpty = (z: SubjectZaznamnik) => z.ph.sections.length === 0 && z.vt.tests.length === 0;

/** Column → value, keyed by header so a reordered table reads the same. */
function cells(arch: PhArch | undefined): Map<string, { label: string; value: string }> {
  const out = new Map<string, { label: string; value: string }>();
  if (!arch) return out;
  const seen = new Map<string, number>();
  arch.columns.forEach((column, i) => {
    const label = norm(column);
    // Two columns with the same header stay apart by occurrence, not position.
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    out.set(n === 1 ? label : `${label}#${n}`, { label, value: norm(arch.values[i] ?? '') });
  });
  return out;
}

function phChanges(prev: SubjectZaznamnik, fresh: SubjectZaznamnik): NewPoint[] {
  const bySection = new Map<string, PhArch>();
  const byName = new Map<string, PhArch[]>();
  for (const section of prev.ph.sections) {
    for (const arch of section.arches) {
      bySection.set(`${norm(section.label)}\u0000${norm(arch.name)}`, arch);
      byName.set(norm(arch.name), [...(byName.get(norm(arch.name)) ?? []), arch]);
    }
  }

  const out: NewPoint[] = [];
  for (const section of fresh.ph.sections) {
    for (const arch of section.arches) {
      const name = norm(arch.name);
      // The section label names the seminar group and its time, so it changes
      // when the group does; the arch's own name is what the teacher keeps.
      const sameName = byName.get(name);
      const before = cells(
        bySection.get(`${norm(section.label)}\u0000${name}`) ??
          (sameName?.length === 1 ? sameName[0] : undefined)
      );
      for (const [key, { label, value }] of cells(arch)) {
        if (value !== '' && value !== (before.get(key)?.value ?? '')) out.push({ label, value });
      }
    }
  }
  const scored = out.filter((p) => !TOTAL_COLUMN.test(p.label));
  return scored.length > 0 ? scored : out;
}

function vtChanges(prev: SubjectZaznamnik, fresh: SubjectZaznamnik): NewPoint[] {
  // Several attempts can share a name and a time (a real subject lists 25 under
  // 12 pairs), so the key counts its own occurrences: the n-th attempt with a
  // key is compared with the n-th before. Keyed by name and time alone, the
  // last duplicate's score stood for all of them and the rest were "new" on
  // every sync.
  const keyed = (tests: SubjectZaznamnik['vt']['tests']) => {
    const seen = new Map<string, number>();
    return tests.map((t) => {
      const base = `${norm(t.name)}\u0000${norm(t.submittedAt)}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return { key: `${base}\u0000${n}`, t };
    });
  };
  const before = new Map(keyed(prev.vt.tests).map(({ key, t }) => [key, t.score]));
  return keyed(fresh.vt.tests)
    .filter(({ key, t }) => before.get(key) !== t.score)
    .map(({ t }) => ({ label: norm(t.name), value: `${t.score}/${t.maxScore}` }));
}

/**
 * What the teacher added to a subject's záznamník between two syncs.
 *
 * Nothing without a previous copy (the first sync after install or after a
 * cleared cache would otherwise announce every point the student ever got) and
 * nothing for a failed or empty fetch. A cleared value is not news.
 */
export function diffZaznamnik(
  prev: SubjectZaznamnik | null | undefined,
  fresh: SubjectZaznamnik | null | undefined
): NewPoint[] {
  if (!prev || !fresh || isEmpty(prev) || isEmpty(fresh)) return [];
  return [...phChanges(prev, fresh), ...vtChanges(prev, fresh)];
}
