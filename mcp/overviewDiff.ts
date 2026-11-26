// The comparison of a fresh look at IS with the record of what the overview already
// reported (overviewRecord.ts): what is new, as one line each (docs/superpowers/specs/
// 2026-11-25-reis-for-claude-map-design.md, step 3).
import type { PointRow, BoxRow } from './overviewShape';
import { hash, own, type FileLite, type Snapshot, type World } from './overviewRecord';

export type Change = {
  kind: 'subject' | 'file' | 'points' | 'box' | 'exam' | 'ledger';
  code: string;
  /** For files: new, replaced or gone, so a long run of them can be summed up. */
  what?: 'new' | 'replaced' | 'gone';
  /** For a new or replaced file: its link, so the map can mark it. */
  url?: string;
  /** For a file gone from IS: the link it had, so the ledger can tell which entries lost their source. */
  was?: string;
  /** For points rows, assignment boxes and exam terms: the record key, so a change left out can be held back. */
  key?: string;
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
    // A part that could not be read last time has no entry: what is read now is compared
    // with an empty baseline, so it is reported as new instead of being recorded unseen.
    const files = world.files[code];
    if (files) out.push(...fileChanges(code, prev.files[code] ?? {}, files));
    const points = world.points[code];
    if (points) out.push(...pointChanges(code, prev.points[code] ?? {}, points));
  }
  if (world.boxes) out.push(...boxChanges(prev.boxes ?? {}, world.boxes));
  if (world.exams) {
    const seen = prev.exams ?? {};
    for (const e of world.exams) {
      if (e.state === 'registered' || own(seen, e.key)) continue;
      out.push({
        kind: 'exam',
        code: e.code,
        key: e.key,
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
        was: url,
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
      out.push({ kind: 'points', code, key: p.key, text: `New points row in ${code}: ${p.key}` });
    } else if (before[p.key] !== hash(p.text)) {
      out.push({ kind: 'points', code, key: p.key, text: `Points changed in ${code}: ${p.key}` });
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
        key: b.key,
        text: `New assignment box in ${b.code}: ${b.name}, deadline ${b.deadline || 'none'}`,
      });
    } else if (was.d !== b.deadline) {
      out.push({
        kind: 'box',
        code: b.code,
        key: b.key,
        text: `Assignment deadline changed in ${b.code}: ${b.name}, ${was.d || 'none'} -> ${b.deadline || 'none'}`,
      });
    }
  }
  return out;
}

/**
 * The lines to show. Past `max` everything but subjects is summed up per kind and
 * subject (the details are in the map below), so the list stays short, nothing is cut
 * and nothing is lost: changes are reported only once.
 */
export function changeLines(changes: Change[], max = 40): string[] {
  if (changes.length <= max) return changes.map((c) => c.text);
  const lines: string[] = [];
  const sums = new Map<string, { n: number; label: string }>();
  const words: Record<string, string> = {
    'file|new': 'new files',
    'file|replaced': 'replaced files',
    'file|gone': 'files gone from IS',
    points: 'new or changed points rows',
    box: 'new or changed assignment boxes',
    exam: 'new exam terms',
    ledger: 'ledger entries to recheck',
  };
  for (const c of changes) {
    if (c.kind === 'subject') {
      lines.push(c.text);
      continue;
    }
    const w = c.kind === 'file' ? `file|${c.what}` : c.kind;
    const k = `${w}|${c.code}`;
    const cur = sums.get(k) ?? { n: 0, label: `${words[w]} in ${c.code}` };
    cur.n++;
    sums.set(k, cur);
  }
  for (const { n, label } of sums.values()) lines.push(`${n} ${label} (see the map below)`);
  return lines;
}

/**
 * The world as the record should see it when the answer left `held` changes out: a held new
 * file is not there yet and a held replaced file still has its old date, so the next overview
 * finds them different from the record and reports them. Only new and replaced files are ever
 * held (a change with a `url`).
 */
export function holdBack(prev: Snapshot | null, world: World, held: Change[]): World {
  if (!held.length) return world;
  const urls = new Map<string, Set<string>>();
  for (const c of held) if (c.url) urls.set(c.code, (urls.get(c.code) ?? new Set()).add(c.url));
  const files = { ...world.files };
  for (const [code, hold] of urls) {
    const before = prev?.files[code];
    files[code] = files[code]?.flatMap((f) => {
      if (!hold.has(f.url)) return [f];
      const was = own(before, f.url) ? before![f.url] : undefined;
      return was ? [{ ...f, label: was.n, modified: was.m }] : [];
    });
  }
  return { ...world, files };
}
