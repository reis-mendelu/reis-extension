// "upcoming": what the student has coming, soonest first, with the days left and
// whether they must be there in person. One flat list with a `source` per item: the
// exam and credit terms the student is registered for and open assignment boxes not yet
// handed in (both read from IS by reIS, so exact), and the events in the ledger Claude
// keeps (ledgerUpcoming.ts, step 4b of the map).
import type { BoxRow, ExamRow } from './overviewShape';
import { ledgerItems } from './ledgerUpcoming';
import type { LedgerEntry } from './ledgerEntry';
import type { Listings } from './ledgerSource';
import { DAY, parsePrague, pragueToday } from './pragueTime';

export type Upcoming = {
  /** DD.MM.YYYY HH:MM as IS prints it (a window: "from – to"). */
  when: string;
  daysLeft: number;
  kind: 'exam' | 'assignment' | (string & {});
  code: string;
  title: string;
  /** 'yes' when the student has to be there (an exam term, a defence); empty otherwise. */
  attendance: 'yes' | '';
  source: 'is-exam' | 'is-assignment' | 'ledger' | (string & {});
  /** 'yes' for anything within 14 days: the look a weekly digest takes. */
  inNext14Days?: 'yes';
  /** Ledger items only: the entry's id, and whether the date is stated or inferred. */
  id?: string;
  basis?: 'stated' | 'inferred';
  room?: string;
  unregisterBy?: string;
  /** Set when the file the date came from was replaced or is gone. */
  recheck?: string;
  /** An inferred date: how, and to confirm it with the teacher. */
  confirm?: string;
};

const MAX_SHOWN = 20;
export const SOON_DAYS = 14;

/** Soonest first; items already past are dropped, a long list is cut with its size said. */
export function upcomingItems(
  boxes: BoxRow[] | undefined,
  exams: ExamRow[] | undefined,
  now: Date,
  ledger?: { entries: LedgerEntry[]; listings: Listings },
  limit = MAX_SHOWN
): { items: Upcoming[]; more: number } {
  const today = pragueToday(now.getTime());
  const all: { at: number; item: Upcoming }[] = [];
  const add = (when: ReturnType<typeof parsePrague>, item: Omit<Upcoming, 'daysLeft'>) => {
    if (!when || when.at < now.getTime()) return;
    all.push({ at: when.at, item: { ...item, daysLeft: Math.round((when.day - today) / DAY) } });
  };
  for (const e of exams ?? []) {
    if (e.state !== 'registered') continue;
    add(parsePrague(e.date, e.time), {
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
    add(parsePrague(b.deadline), {
      when: b.deadline,
      kind: 'assignment',
      code: b.code,
      title: b.name,
      attendance: '',
      source: 'is-assignment',
    });
  }
  if (ledger) {
    const isTerms = new Set(
      all.filter((a) => a.item.source === 'is-exam').map((a) => `${a.item.code}|${a.at}`)
    );
    for (const l of ledgerItems(ledger.entries, now, ledger.listings)) {
      // An exam term the student registered for is already here, exact, from IS itself.
      if (l.timed && isTerms.has(`${l.item.code}|${l.at}`)) continue;
      all.push({ at: l.at, item: l.item });
    }
  }
  const sorted = all
    .sort((a, b) => a.at - b.at)
    .map((x) =>
      x.item.daysLeft <= SOON_DAYS ? { ...x.item, inNext14Days: 'yes' as const } : x.item
    );
  return { items: sorted.slice(0, limit), more: Math.max(0, sorted.length - limit) };
}
