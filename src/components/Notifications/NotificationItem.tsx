import { useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { SpolekNotification } from '../../services/spolky';
import { ASSOCIATION_PROFILES } from '../../services/spolky/config';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * `clickable` is the affordance, not the link. A notification IS a
 * `spolky_events` row, so the phone's Novinky sheet can open one on the map
 * whether or not the author set a `url` — a control that acts has to look like
 * it does. It defaults to the link, which is exactly what the desktop dropdown
 * (where a linkless notification is still inert) relied on before this prop.
 *
 * The row itself is `ExamRowCard`'s: accent rail, title over muted subtitle,
 * right column of meta. It used to be a 40px circular avatar and a single bold
 * line, which put its text 48px right of the deadline rows it was stacked
 * against — the misalignment students reported.
 *
 * The avatar is gone rather than resized. It was the same bell glyph on every
 * admin row, so it told a student nothing they could read, and it cost the 48px
 * that broke the column. The sender is on the subtitle line now as its name —
 * "ESN Mendelu" beats an unlabelled 40px logo at 375px wide.
 */
export function NotificationItem({
  notification,
  onClick,
  onVisible,
  clickable,
}: {
  notification: SpolekNotification;
  onClick: () => void;
  onVisible?: () => void;
  clickable?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!onVisible || !ref.current) return;
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            onVisible();
            obs.unobserve(ref.current!);
          }
        }),
      { threshold: 0.5 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [onVisible]);

  const assocId = notification.associationId || 'admin';
  // Academic rows are reIS's own — the deadline feed, not a society's — and
  // there is no profile to name. `t` gives them the app's name instead of a
  // blank line, which would collapse the row to a different height.
  const source = ASSOCIATION_PROFILES[assocId]?.name ?? t('notifications.fromReis');

  const d = new Date(notification.expiresAt);
  const now = new Date();
  const diffDays = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000
  );
  const dateLabel =
    diffDays === 0
      ? t('common.today')
      : diffDays === 1
        ? t('notifications.tomorrow')
        : `${d.getDate()}.${d.getMonth() + 1}.`;

  const isClickable = clickable ?? !!notification.link;
  // Today and tomorrow are the rows a student is deciding about right now, so
  // they get the full-strength weight; a date three weeks out is reference, not
  // a prompt. Weight rather than colour, for the same reason the deadline row's
  // time is not amber — lime on the light theme's base-100 does not reach AA.
  const isSoon = diffDays <= 1;

  return (
    <button
      ref={ref}
      onClick={onClick}
      // `cursor-default` only tells a MOUSE the row is inert. Left enabled, it
      // stays a focus stop that announces itself as an actionable control and
      // then swallows its own activation — so the row is disabled outright, and
      // the cursor rule is what a pointer sees of the same decision.
      disabled={!isClickable}
      className={`flex w-full items-center gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5 text-left transition-colors ${isClickable ? 'cursor-pointer hover:bg-base-200' : 'cursor-default'}`}
    >
      <span className="h-8 w-1 flex-shrink-0 rounded-full bg-primary" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-md font-bold text-base-content">{notification.title}</span>
        <span className="truncate text-2sm text-base-content/60">{source}</span>
      </span>
      <span
        className={`flex-shrink-0 whitespace-nowrap text-2sm ${isSoon ? 'font-bold text-base-content' : 'text-base-content/60'}`}
      >
        {dateLabel}
      </span>
      {isClickable && (
        <ChevronRight size={16} className="flex-shrink-0 text-base-content/40" aria-hidden />
      )}
    </button>
  );
}
