// "upcoming": what the student has coming, soonest first, with the days left and
// whether they must be there in person. One flat list with a `source` per item, so
// other sources (the ledger Claude keeps, step 4b of the map) can add items of the
// same shape without changing the tool's output. Today it is filled from IS: the
// exam and credit terms the student is registered for, and open assignment boxes
// not yet handed in.
import type { BoxRow, ExamRow } from './overviewShape';

export type Upcoming = {
  /** DD.MM.YYYY HH:MM as IS prints it. */
  when: string;
  daysLeft: number;
  kind: 'exam' | 'assignment' | (string & {});
  code: string;
  title: string;
  /** 'yes' when the student has to be there (an exam term); empty otherwise. */
  attendance: 'yes' | '';
  source: 'is-exam' | 'is-assignment' | (string & {});
};

const DAY = 86_400_000;
const MAX_SHOWN = 20;

/** IS prints DD.MM.YYYY and, for a term or a deadline, HH:MM. */
function parse(date: string, time = ''): Date | null {
  const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(
    `${date} ${time}`.trim()
  );
  if (!m) return null;
  return new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    Number(m[4] ?? 23),
    Number(m[5] ?? 59)
  );
}

/** Soonest first; items already past are dropped, a long list is cut with its size said. */
export function upcomingItems(
  boxes: BoxRow[] | undefined,
  exams: ExamRow[] | undefined,
  now: Date
): { items: Upcoming[]; more: number } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const all: { at: number; item: Upcoming }[] = [];
  const add = (at: Date | null, item: Omit<Upcoming, 'daysLeft'>) => {
    if (!at || at.getTime() < now.getTime()) return;
    const day = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
    all.push({ at: at.getTime(), item: { ...item, daysLeft: Math.round((day - today) / DAY) } });
  };
  for (const e of exams ?? []) {
    if (e.state !== 'registered') continue;
    add(parse(e.date, e.time), {
      when: `${e.date} ${e.time}`.trim(),
      kind: 'exam',
      code: e.code,
      title: `${e.section}${e.room ? `, ${e.room}` : ''}`,
      attendance: 'yes',
      source: 'is-exam',
    });
  }
  for (const b of boxes ?? []) {
    if (!b.open || b.submission === 'handed_in') continue;
    add(parse(b.deadline), {
      when: b.deadline,
      kind: 'assignment',
      code: b.code,
      title: b.name,
      attendance: '',
      source: 'is-assignment',
    });
  }
  const sorted = all.sort((a, b) => a.at - b.at).map((x) => x.item);
  return { items: sorted.slice(0, MAX_SHOWN), more: Math.max(0, sorted.length - MAX_SHOWN) };
}
