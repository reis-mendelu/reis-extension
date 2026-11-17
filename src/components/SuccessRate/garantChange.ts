import type { SemesterStats } from '../../types/documents';

/**
 * A subject's success rate spans several semesters, and the garant (who sets
 * the exam) can change between them — then the older semesters say little
 * about the subject as it is taught now. The garant of each period comes from
 * IS's success-rate page itself (`SemesterStats.garant`, via reis-data).
 *
 * Every function here takes semesters NEWEST FIRST, as SuccessRateView shows
 * them, and ignores semesters whose garant is unknown (crawled before capture).
 */

/** "doc. Ing. Oldřich Trenz, Ph.D." → "Oldřich Trenz". Titles change when a
 * garant gains a degree, so they are dropped before comparing, and they would
 * also push the note past one line. */
export function plainName(name: string): string {
  const beforeComma = name.split(',')[0] ?? name;
  const words = beforeComma.split(/\s+/).filter((w) => w && !w.endsWith('.') && w !== 'et');
  return words.join(' ') || name.trim();
}

const known = (s: SemesterStats) => (s.garant ? plainName(s.garant) : null);

export interface GarantChange {
  /** The oldest shown semester of the current garant: when they took over. */
  since: SemesterStats;
  before: string;
  now: string;
}

/** The most recent garant change among `stats`, or null if there was none. */
export function garantChange(stats: SemesterStats[]): GarantChange | null {
  let now: string | null = null;
  let since: SemesterStats | null = null;
  for (const s of stats) {
    const g = known(s);
    if (g === null) continue;
    if (now === null || g === now) {
      now = g;
      since = s;
      continue;
    }
    return { since: since!, before: g, now };
  }
  return null;
}

/** Indices of the chips that start a different garant than the known one
 * before them; SemesterSelector draws a divider in front of each. */
export function garantBoundaries(stats: SemesterStats[]): Set<number> {
  const out = new Set<number>();
  let last: string | null = null;
  stats.forEach((s, i) => {
    const g = known(s);
    if (g === null) return;
    if (last !== null && g !== last) out.add(i);
    last = g;
  });
  return out;
}
