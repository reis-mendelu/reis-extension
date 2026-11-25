// The comparison of a fresh look at IS with the record of what the overview already
// reported (overviewRecord.ts): what is new, as one line each (docs/superpowers/specs/
// 2026-11-25-reis-for-claude-map-design.md, step 3).
import type { PointRow, BoxRow } from './overviewShape';
import { hash, own, type FileLite, type Snapshot, type World } from './overviewRecord';

export type Change = {
  kind: 'subject' | 'file' | 'points' | 'box' | 'exam';
  code: string;
  /** For files: new, replaced or gone, so a long run of them can be summed up. */
  what?: 'new' | 'replaced' | 'gone';
  /** For a new or replaced file: its link, so the map can mark it. */
  url?: string;
  text: string;
};

/** What is new since `prev`, which the caller knows exists (no record means a first overview). */
export function diffWorld(prev: Snapshot, world: World): Change[] {
  const out: Change[] = [];
  const names = new Map(world.subjects.map((s) => [s.code, s.name]));
  const fresh = new Set<string>();
  for (const s of world.subjects) {
    if (!own(prev.subjects, s.code)) {
      fresh.add(s.code);
      out.push({ kind: 'subject', code: s.code, text: `New subject: ${s.code} ${s.name}`.trim() });
    }
  }
  for (const code of Object.keys(prev.subjects)) {
    if (!names.has(code)) {
      out.push({ kind: 'subject', code, text: `Subject no longer listed in IS: ${code}` });
    }
  }
  for (const code of names.keys()) {
    // A subject that is new brings all its files and points: that is one line, not a flood.
    if (fresh.has(code)) continue;
    const files = world.files[code];
    const before = prev.files[code];
    if (files && before) out.push(...fileChanges(code, before, files));
    const points = world.points[code];
    const was = prev.points[code];
    if (points && was) out.push(...pointChanges(code, was, points));
  }
  if (world.boxes && prev.boxes) out.push(...boxChanges(prev.boxes, world.boxes));
  if (world.exams && prev.exams) {
    for (const e of world.exams) {
      if (e.state === 'registered' || own(prev.exams, e.key)) continue;
      out.push({
        kind: 'exam',
        code: e.code,
        text: `New exam term in ${e.code}: ${e.section} ${e.date} ${e.time}${e.room ? ` ${e.room}` : ''}`.trim(),
      });
    }
  }
  return out;
}

function fileChanges(code: string, before: Snapshot['files'][string], files: FileLite[]): Change[] {
  const out: Change[] = [];
  const now = new Set<string>();
  for (const f of files) {
    now.add(f.url);
    const was = own(before, f.url) ? before[f.url] : undefined;
    if (!was) {
      out.push({
        kind: 'file',
        what: 'new',
        code,
        url: f.url,
        text: `New file in ${code}: ${f.label} (${f.modified})`,
      });
    } else if (was.m !== f.modified) {
      // A replaced file keeps its link: only IS's date changes.
      out.push({
        kind: 'file',
        what: 'replaced',
        code,
        url: f.url,
        text: `Replaced file in ${code}: ${f.label} (modified ${was.m} -> ${f.modified})`,
      });
    }
  }
  for (const [url, was] of Object.entries(before)) {
    if (!now.has(url)) {
      out.push({
        kind: 'file',
        what: 'gone',
        code,
        text: `File gone from IS in ${code}: ${was.n}`,
      });
    }
  }
  return out;
}

function pointChanges(code: string, before: Record<string, string>, points: PointRow[]): Change[] {
  const out: Change[] = [];
  for (const p of points) {
    if (!own(before, p.key)) {
      out.push({ kind: 'points', code, text: `New points row in ${code}: ${p.key}` });
    } else if (before[p.key] !== hash(p.text)) {
      out.push({ kind: 'points', code, text: `Points changed in ${code}: ${p.key}` });
    }
  }
  return out;
}

function boxChanges(before: NonNullable<Snapshot['boxes']>, boxes: BoxRow[]): Change[] {
  const out: Change[] = [];
  for (const b of boxes) {
    const was = own(before, b.key) ? before[b.key] : undefined;
    if (!was) {
      out.push({
        kind: 'box',
        code: b.code,
        text: `New assignment box in ${b.code}: ${b.name}, deadline ${b.deadline || 'none'}`,
      });
    } else if (was.d !== b.deadline) {
      out.push({
        kind: 'box',
        code: b.code,
        text: `Assignment deadline changed in ${b.code}: ${b.name}, ${was.d || 'none'} -> ${b.deadline || 'none'}`,
      });
    }
  }
  return out;
}

/**
 * The lines to show. Past `max` the file changes are summed up per subject (their
 * names are in the map with their dates), so nothing is cut and nothing is lost.
 */
export function changeLines(changes: Change[], max = 40): string[] {
  if (changes.length <= max) return changes.map((c) => c.text);
  const lines: string[] = [];
  const sums = new Map<string, number>();
  for (const c of changes) {
    if (c.kind !== 'file') lines.push(c.text);
    else {
      const k = `${c.what}|${c.code}`;
      sums.set(k, (sums.get(k) ?? 0) + 1);
    }
  }
  const word = {
    new: 'new files',
    replaced: 'replaced files',
    gone: 'files gone from IS',
  } as const;
  for (const [k, n] of sums) {
    const [what, code] = k.split('|') as [keyof typeof word, string];
    lines.push(
      `${n} ${word[what]} in ${code}${what === 'gone' ? '' : ` (marked in the files of ${code} below)`}`
    );
  }
  return lines;
}
