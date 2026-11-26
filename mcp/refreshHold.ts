// The record mendelu_refresh writes keeps a points row, an assignment box or an exam term as it
// was when the answer had to leave its change out (refreshReport.ts), so the next refresh finds it
// different again and reports it: a change is recorded as seen only once it was reported.
// (Files are held the same way by overviewDiff.holdBack.)
import type { Change } from './overviewDiff';
import { own, type Snapshot } from './overviewRecord';

function restore<T>(
  next: Record<string, T> | undefined,
  prev: Record<string, T> | undefined,
  key: string
) {
  if (!next) return;
  if (prev && own(prev, key)) next[key] = prev[key]!;
  else delete next[key];
}

/** `held`: the non-file changes this answer did not show. Edits `next` in place. */
export function holdUnreported(next: Snapshot, prev: Snapshot | null, held: Change[]) {
  for (const c of held) {
    if (!c.key && c.kind !== 'subject') continue;
    const key = c.key ?? '';
    if (c.kind === 'points') restore(next.points[c.code], prev?.points[c.code], key);
    else if (c.kind === 'box') restore(next.boxes, prev?.boxes, key);
    else if (c.kind === 'exam') restore(next.exams, prev?.exams, key);
    else if (c.kind === 'subject') {
      // A new subject left out stays new; a vanished one stays recorded until it is reported.
      restore(next.subjects, prev?.subjects, c.code);
      restore(next.files, prev?.files, c.code);
      restore(next.points, prev?.points, c.code);
    }
  }
}
