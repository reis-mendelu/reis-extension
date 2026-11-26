// What the overview keeps of each thing IS returned: a key that stays the same
// from one refresh to the next, and a label to show. Nothing here asks IS for
// anything. The keys are what overviewDiff.ts compares, so they only use what a
// teacher or the student can really change (never a timestamp or a capacity).
import { isBoxOpen } from '../src/utils/submissionBoxes';
import { pragueAsLocal } from './pragueTime';
import type { Odevzdavarna } from '../src/api/odevzdavarny';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.filter(isObject) : []);
const str = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';

export type PointRow = { key: string; text: string };
export type BoxRow = {
  key: string;
  code: string;
  name: string;
  deadline: string;
  open: boolean;
  submission: string;
  points: string;
};
export type ExamRow = {
  key: string;
  code: string;
  section: string;
  state: 'registered' | 'open' | 'full';
  date: string;
  time: string;
  room: string;
};

/**
 * Keys that stay unique within one answer: a repeated key gets " #n" (or "|n") after it, and a
 * suffixed key already taken by another row's own label is skipped, so no two rows ever share
 * a key (snapshotOf would overwrite one fingerprint with the other).
 */
function uniqueKeys(sep: string) {
  const used = new Set<string>();
  const count = new Map<string, number>();
  return (base: string) => {
    let n = count.get(base) ?? 0;
    let key: string;
    do key = ++n > 1 ? `${base}${sep}${n}` : base;
    while (used.has(key));
    count.set(base, n);
    used.add(key);
    return key;
  };
}

/** The student's own rows in the teacher's tables, and their graded online tests. */
export function pointRows(value: unknown): PointRow[] {
  const v = isObject(value) ? value : {};
  const rows: PointRow[] = [];
  // Two rows can share a label: the second is told apart by its place, so each keeps its own fingerprint.
  const unique = uniqueKeys(' #');
  for (const section of list(v.continuousAssessment)) {
    for (const arch of list(section.arches)) {
      if (arch.empty === true) continue;
      const columns = Array.isArray(arch.columns) ? arch.columns.map(str) : [];
      const values = Array.isArray(arch.values) ? arch.values.map(str) : [];
      const cells = values.map((x, i) => (columns[i] ? `${columns[i]}=${x}` : x)).filter(Boolean);
      if (!cells.length) continue;
      rows.push({
        key: unique(`${str(section.label)} / ${str(arch.name)}`),
        text: cells.join(', '),
      });
    }
  }
  for (const t of list(v.tests)) {
    const when = str(t.submittedAt);
    rows.push({
      key: unique(`test / ${str(t.name)} / ${when}`),
      text: `${str(t.name)}: ${str(t.score)}/${str(t.maxScore)}${when ? ` (${when})` : ''}`,
    });
  }
  return rows;
}

/** Every box of the period, from what mendelu_assignments returns. */
export function boxRows(value: unknown, now: number): BoxRow[] {
  const unique = uniqueKeys('|');
  const rows = list(isObject(value) ? value.assignments : []);
  const label = (r: Record<string, unknown>) =>
    `${str(r.courseCode) || str(r.courseId)}|${str(r.name)}`;
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(label(r), (seen.get(label(r)) ?? 0) + 1);
  return rows.map((r) => {
    const code = str(r.courseCode) || str(r.courseId);
    const name = str(r.name);
    // Two boxes can share a name. IS's own box id tells them apart and survives a hand-in, a
    // moved deadline and a second box appearing. Without an id (an older answer), the deadline
    // does, and the place in the list only when that is the same too.
    const id = str(r.odevzdavarnaId);
    const base = id
      ? `${code}|#${id}`
      : (seen.get(label(r)) ?? 0) > 1
        ? `${label(r)}|${str(r.deadline)}`
        : label(r);
    return {
      key: unique(base),
      code,
      name,
      deadline: str(r.deadline),
      open: isBoxOpen(r as unknown as Odevzdavarna, pragueAsLocal(now)),
      submission: str(r.submission),
      points: str(r.points),
    };
  });
}

/** IS prints DD.MM.YYYY: sortable as YYYYMMDD. */
const dayKey = (d: string) => {
  const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(d);
  return m ? `${m[3]}${m[2]!.padStart(2, '0')}${m[1]!.padStart(2, '0')}` : d;
};

/**
 * The registered terms and the terms still open. The key is the term's own id,
 * never its capacity: a term filling up is not news.
 */
export function examRows(value: unknown): ExamRow[] {
  const rows: ExamRow[] = [];
  for (const subject of list(value)) {
    const code = str(subject.code);
    for (const s of list(subject.sections)) {
      const section = str(s.name) || str(s.type);
      const sid = str(s.id);
      const reg = isObject(s.registeredTerm) ? s.registeredTerm : null;
      if (reg) {
        const id = str(reg.id) || `${str(reg.date)} ${str(reg.time)}`;
        rows.push({
          key: `${code}|${sid}|${id}`,
          code,
          section,
          state: 'registered',
          date: str(reg.date),
          time: str(reg.time),
          room: str(reg.room),
        });
      }
      for (const t of list(s.terms)) {
        const id = str(t.id) || `${str(t.date)} ${str(t.time)}`;
        const key = `${code}|${sid}|${id}`;
        if (rows.some((r) => r.key === key)) continue;
        rows.push({
          key,
          code,
          section,
          state: t.full === true ? 'full' : 'open',
          date: str(t.date),
          time: str(t.time),
          room: str(t.room),
        });
      }
    }
  }
  return rows.sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
}

/** One line of a lesson: the week ahead needs the day, the hour, the subject and the room. */
export function weekRows(rows: Record<string, string>[]) {
  return rows.map((r) => ({
    date: r.date,
    time: `${r.start}-${r.end}`,
    code: r.code,
    kind: r.kind,
    room: r.room,
  }));
}
