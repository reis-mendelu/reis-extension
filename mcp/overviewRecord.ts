// The record of what the overview has already told Claude (overview/seen.json in the
// store): fingerprints, not grades. A file's link and the date IS shows for it, a
// points row's hash, an assignment's deadline, an exam term's id. A part that could not
// be read this time is left out of `World` and keeps its old record: a failed request
// is never "gone" or "empty". See overviewDiff.ts for the comparison.
import { createHash } from 'node:crypto';
import type { BoxRow, ExamRow, PointRow } from './overviewShape';

export type FileLite = { url: string; label: string; modified: string };
export type World = {
  subjects: { code: string; name: string }[];
  files: Record<string, FileLite[] | undefined>;
  points: Record<string, PointRow[] | undefined>;
  boxes?: BoxRow[];
  exams?: ExamRow[];
};

export type Snapshot = {
  version: 1;
  subjects: Record<string, string>;
  files: Record<string, Record<string, { n: string; m: string }>>;
  points: Record<string, Record<string, string>>;
  boxes?: Record<string, { n: string; c: string; d: string }>;
  exams?: Record<string, string>;
};

/** Own properties only: a file or a points row may be named like an Object property. */
export const own = (o: object | undefined, k: string) => !!o && Object.hasOwn(o, k);
export const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** What a file in the record looks like, so one that is not is treated as a missing record. */
export function parseSnapshot(raw: string | undefined): Snapshot | null {
  try {
    const s = JSON.parse(raw ?? 'null') as unknown;
    if (!isRecord(s) || s.version !== 1) return null;
    if (!isRecord(s.subjects) || !isRecord(s.files) || !isRecord(s.points)) return null;
    return s as unknown as Snapshot;
  } catch {
    return null;
  }
}

/** The record after this overview: this look at IS, with the old record kept for what failed. */
export function snapshotOf(world: World, prev: Snapshot | null): Snapshot {
  const next: Snapshot = { version: 1, subjects: {}, files: {}, points: {} };
  for (const s of world.subjects) {
    next.subjects[s.code] = s.name;
    const files = world.files[s.code];
    const kept = prev?.files[s.code];
    if (files) {
      next.files[s.code] = Object.fromEntries(
        files.map((f) => [f.url, { n: f.label, m: f.modified }])
      );
    } else if (kept) next.files[s.code] = kept;
    const points = world.points[s.code];
    const keptPoints = prev?.points[s.code];
    if (points) next.points[s.code] = Object.fromEntries(points.map((p) => [p.key, hash(p.text)]));
    else if (keptPoints) next.points[s.code] = keptPoints;
  }
  const boxes = world.boxes
    ? Object.fromEntries(world.boxes.map((b) => [b.key, { n: b.name, c: b.code, d: b.deadline }]))
    : prev?.boxes;
  if (boxes) next.boxes = boxes;
  const exams = world.exams
    ? Object.fromEntries(world.exams.map((e) => [e.key, `${e.date} ${e.time}`.trim()]))
    : prev?.exams;
  if (exams) next.exams = exams;
  return next;
}
