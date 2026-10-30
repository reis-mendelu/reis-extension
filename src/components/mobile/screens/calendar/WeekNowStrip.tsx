import type { NowNext } from '../../../../utils/mobile/nowNext';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAppStore } from '../../../../store/useAppStore';
import { localizedCourseName } from '../../../../utils/localizedLesson';
import { lessonDisplayName } from '../../../../utils/courseDisplayName';
import { lessonPlace } from '../../../../utils/lessonPlace';

/**
 * Týden's "Teď" strip on a phone: NowNextCard's answer in about half its
 * height, because the week grid never scrolls and needs the rest
 * (spec 2026-10-30, decision 8). The running lesson, its room and Trasa on one
 * line, the progress bar, then what follows.
 *
 * Same data and the same rules as the card: it shows only while a lesson
 * runs, and Trasa only when the room is somewhere the map can walk to. A
 * student in Týden asks "where do I go right now" here, without opening a
 * block. An iPad has the room for the full card instead.
 */
export function WeekNowStrip({ data, onRoute }: { data: NowNext; onRoute: () => void }) {
  const { t, language } = useTranslation();
  const nicknames = useAppStore((s) => s.courseNicknames);
  const { current, next, elapsedPct } = data;
  const place = lessonPlace(current, language);
  const name = lessonDisplayName(nicknames, current, localizedCourseName(current, language));
  const nextName = next
    ? lessonDisplayName(nicknames, next, localizedCourseName(next, language))
    : '';

  return (
    <div
      data-testid="week-now-strip"
      className="mx-4 mt-3 flex flex-shrink-0 flex-col gap-1.5 rounded-2xl border border-primary/25 bg-base-100 px-3.5 py-2"
    >
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 text-xs font-extrabold uppercase tracking-wide text-[var(--tone-primary)]">
          {t('mobile.calendar.nowLabel')}
        </span>
        {/* The name gives way, never the room: "Vývoj webových aplikací ·
            Q…" at 390px hid the one thing this strip is for. */}
        <span className="flex min-w-0 flex-1 items-baseline gap-1 text-md font-bold">
          <span className="truncate">{name}</span>
          {place.label && (
            // The room yields only after the name has: shrink-[0.2] against the
            // name's default 1, so a long off-campus label truncates last.
            <span className="min-w-0 shrink-[0.2] truncate whitespace-nowrap">· {place.label}</span>
          )}
        </span>
        {place.routable && (
          <button
            type="button"
            onClick={onRoute}
            className="-my-2 flex min-h-11 flex-shrink-0 items-center whitespace-nowrap pl-2 text-sm font-semibold text-[var(--tone-primary)]"
          >
            {t('mobile.calendar.route')}
          </button>
        )}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-base-300">
        <div className="h-full rounded-full bg-primary" style={{ width: `${elapsedPct}%` }} />
      </div>
      {next && (
        <span className="truncate text-sm font-medium text-base-content/70">
          <span className="font-bold text-base-content/80">{t('mobile.calendar.nextLabel')}</span>{' '}
          {[nextName, lessonPlace(next, language).label, next.startTime]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  );
}
