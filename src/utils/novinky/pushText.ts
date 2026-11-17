import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import type { SpolekNotification } from '../../services/spolky/types';
import type { PushGroup, PushKind, PushRow } from './pushPlan';

/**
 * The rows that are news the moment they appear. The dated rows (your exam,
 * registration opening or closing, a box closing) are notified at their own
 * time by scheduled reminders, not when they enter the list days ahead.
 */
const KIND_OF: Partial<Record<DeadlineAlert['type'], PushKind>> = {
  'exam-new-term': 'terms',
  'zaznamnik-points': 'points',
  'assignment-new': 'boxes',
};

/**
 * Novinky's rows, as what the phone may notify. Society rows are always here,
 * switch or not: they are recorded while it is off, so turning it back on does
 * not post every event at once. The switch filters what is posted.
 */
export function pushRowsOf(
  alerts: readonly DeadlineAlert[],
  feed: readonly SpolekNotification[],
  societyNameOf: (n: SpolekNotification) => string
): PushRow[] {
  const news = alerts.flatMap((a): PushRow[] => {
    const kind = KIND_OF[a.type];
    return kind ? [{ id: a.id, kind, title: a.title, body: a.body, courseCode: a.courseCode }] : [];
  });
  return [
    ...news,
    ...feed.map((n) => ({
      id: n.id,
      kind: 'societies' as const,
      title: n.title,
      body: societyNameOf(n),
    })),
  ];
}

type T = (key: string, params?: Record<string, string>) => string;

const ONE: Record<Exclude<PushKind, 'societies'>, string> = {
  terms: 'novinkyPush.termsOne',
  points: 'novinkyPush.pointsOne',
  boxes: 'novinkyPush.boxesOne',
};
const MANY: Record<PushKind, string> = {
  terms: 'novinkyPush.termsMany',
  points: 'novinkyPush.pointsMany',
  boxes: 'novinkyPush.boxesMany',
  societies: 'novinkyPush.societiesMany',
};

/**
 * The text of one kind's notification: the row's own words when there is one
 * (the same title and line as in Novinky), the subjects or events when a sync
 * brought several.
 */
export function pushText(group: PushGroup, t: T): { title: string; body: string } {
  const [only] = group.rows;
  if (group.rows.length === 1 && only) {
    if (group.kind === 'societies') return { title: only.title, body: only.body };
    return { title: t(ONE[group.kind], { subject: only.title }), body: only.body };
  }
  return {
    title: t(MANY[group.kind]),
    body: [...new Set(group.rows.map((r) => r.title))].join(', '),
  };
}
