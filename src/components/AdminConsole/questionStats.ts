import type { QuestionResult } from '../../api/adminQuestions';

export type QuestionStatus = 'scheduled' | 'live' | 'ended';

export function questionStatus(q: QuestionResult, nowMs = Date.now()): QuestionStatus {
  if (nowMs < Date.parse(q.startsAt)) return 'scheduled';
  return nowMs < Date.parse(q.endsAt) ? 'live' : 'ended';
}

export interface ButtonStat {
  key: string;
  cz: string;
  isLink: boolean;
  n: number;
  /** Share of devices that saw the question; null while nobody has. */
  ofSeen: number | null;
  /** Share of answers (link taps excluded); null for a link or no answers. */
  ofAnswered: number | null;
}

/**
 * What the results card shows. Every device that answered also counted 'seen'
 * (an answer counts seen first), so answers above seen can only come from a
 * caller that is not reIS: the anon counter is spoofable, as post views are.
 */
export function questionStats(q: QuestionResult) {
  const seen = q.totals.seen ?? 0;
  const answerKeys = q.buttons.filter((b) => !b.url).map((b) => b.key);
  const answered = answerKeys.reduce((sum, k) => sum + (q.totals[k] ?? 0), 0);
  const buttons: ButtonStat[] = q.buttons.map((b) => {
    const n = q.totals[b.key] ?? 0;
    return {
      key: b.key,
      cz: b.cz,
      isLink: !!b.url,
      n,
      ofSeen: seen ? n / seen : null,
      ofAnswered: !b.url && answered ? n / answered : null,
    };
  });
  return { seen, answered, buttons, suspicious: answered > seen };
}

/** One row per day, a column per key ('seen' first), for the trend table. */
export function dailyTable(q: QuestionResult) {
  const keys = ['seen', ...q.buttons.map((b) => b.key)];
  const days = [...new Set(q.daily.map((d) => d.day))].sort();
  return {
    keys,
    rows: days.map((day) => ({
      day,
      counts: keys.map((k) => q.daily.find((d) => d.day === day && d.key === k)?.n ?? 0),
    })),
  };
}
