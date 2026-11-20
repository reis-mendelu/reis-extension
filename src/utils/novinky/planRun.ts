import { planPushes, type PushGroup, type PushRow } from './pushPlan';

/** Per source; a source with no key has no record yet (its silent first run). */
export interface Notified {
  alerts?: string[];
  feed?: string[];
  notices?: string[];
}

export interface RunInput {
  /** The alert rows' news (new terms, points, boxes) and the two society sources. */
  news: PushRow[];
  events: PushRow[];
  notices: PushRow[];
  /** A source is recorded only once it is ready, so it never arrives as a backlog. */
  ready: { alerts: boolean; feed: boolean; notices: boolean };
  seen: ReadonlySet<string>;
  before: Notified;
  notifySocieties: boolean;
}

export interface RunPlan {
  toPost: PushGroup[];
  /** The record once the post has landed (or when nothing is to be posted). */
  full: Notified;
  /** The record while the post is in flight: what it adds is held back, for a retry. */
  held: Notified;
}

/**
 * One run of "Novinky rows → system notifications", the decision only: what
 * to post and what to record. Shared by the foreground notifier
 * (src/mobile/novinkyNotifications) and the Android background check
 * (src/mobile/backgroundAnnounce), so the two announce each row once, in the
 * same words, from one record.
 */
export function planRun(i: RunInput): RunPlan {
  const plan = (ready: boolean, rows: PushRow[], known: string[] | undefined) =>
    ready ? planPushes(rows, known, i.seen) : { post: [], notified: known };
  const news = plan(i.ready.alerts, i.news, i.before.alerts);
  const events = plan(i.ready.feed, i.events, i.before.feed);
  const notices = plan(i.ready.notices, i.notices, i.before.notices);
  // Society events and IS notices are one kind, so one notification.
  const school = [...events.post, ...notices.post].flatMap((g) => g.rows);
  const toPost: PushGroup[] = [
    ...news.post,
    ...(i.notifySocieties && school.length > 0
      ? [{ kind: 'societies' as const, rows: school }]
      : []),
  ];
  const full = { alerts: news.notified, feed: events.notified, notices: notices.notified };
  // Only what was not recorded before: a date already announced in a row that
  // gained a new one stays announced, whatever happens to this post.
  const recorded = new Set([
    ...(i.before.alerts ?? []),
    ...(i.before.feed ?? []),
    ...(i.before.notices ?? []),
  ]);
  const adding = new Set(
    toPost
      .flatMap((g) => g.rows.flatMap((r) => [r.id, ...(r.parts ?? [])]))
      .filter((id) => !recorded.has(id))
  );
  const without = (ids?: string[]) => ids?.filter((id) => !adding.has(id));
  return {
    toPost,
    full,
    held: {
      alerts: without(full.alerts),
      feed: without(full.feed),
      notices: without(full.notices),
    },
  };
}
