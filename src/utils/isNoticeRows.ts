import { BASE_URL } from '../api/client';
import type { IsNotice, IsNoticeMute } from '../types/isNotices';
import type { SpolekNotification } from '../services/spolky/types';

const ID_PREFIX = 'is:';

/**
 * The student's IS notices as rows of the Novinky feed, under MENDELU.
 *
 * Built at READ time from the IsNotices slice, never stored in the society feed
 * or its cache. An undated notice (IS's red tile, shown until the student acts)
 * is dated `todayIso`, so it never counts as past; a cached copy disappears
 * with the next read of IS, not with a date.
 *
 * The row's link is the notice's own link, or the IS home page where the
 * notice is when it has none.
 */
export function isNoticeRows(
  notices: IsNotice[],
  mutes: IsNoticeMute[],
  todayIso: string,
  nowIso: string = `${todayIso}T12:00`
): SpolekNotification[] {
  const muted = new Set(mutes.map((m) => m.key));
  return (
    notices
      .filter((n) => !muted.has(n.key))
      // IS's own window, to the minute. IS shows a notice only inside it, but
      // the list can be a cache read hours ago (IndexedDB, or a 30-minute TTL).
      // Both sides are local `YYYY-MM-DDTHH:MM`, which compare as strings.
      .filter((n) => (!n.from || n.from <= nowIso) && (!n.until || n.until >= nowIso))
      .map((n): SpolekNotification => ({
        id: `${ID_PREFIX}${n.key}`,
        associationId: 'mendelu',
        title: n.title,
        body: n.text || n.title,
        link: n.link ?? `${BASE_URL}/auth/index.pl`,
        createdAt: n.from ?? todayIso,
        expiresAt: n.until?.slice(0, 10) ?? todayIso,
        startsAt: n.from?.slice(0, 10),
        priority: n.severity === 'crit' ? 'high' : 'normal',
        source: 'is',
      }))
  );
}

/** The local minute as `YYYY-MM-DDTHH:MM`, the form IS notice windows are in. */
export function localMinuteIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * True for a row (or row id) that came from the student's own IS. Those rows
 * are not `spolky_events` rows: the post view and click counters must never
 * send their ids — that would tell Supabase what a student's IS shows them.
 */
export function isIsNoticeRow(row: string | Pick<SpolekNotification, 'id' | 'source'>): boolean {
  if (typeof row === 'string') return row.startsWith(ID_PREFIX);
  return row.source === 'is' || row.id.startsWith(ID_PREFIX);
}
