interface CalendarEventCardOneLineProps {
  title: string;
  time: string;
  /** What sits over the row's right end: the quick-hide button, the deadline badge, or nothing. */
  overlay: 'none' | 'hideMenu' | 'deadlineBadge';
}

/**
 * A calendar block with room for one line — a 50-minute lesson is about 34px
 * on a 700px-tall window. The time joins the title rather than being dropped:
 * "Cvičení" alone on a row between two other blocks says less than the thing it
 * is sitting next to. The room goes, because something has to, and it is the
 * part the tooltip and the subject drawer both still carry.
 *
 * The right inset keeps the time clear of whatever the card puts at its
 * top-right. The quick-hide button is 24px and appears on hover, so without
 * `pr-8` the time would vanish under a pointer at the moment it is read. The
 * deadline badge ("2t", "now") is up to ~42px from the edge and is always
 * showing, hence the wider `pr-12`.
 */
export function CalendarEventCardOneLine({ title, time, overlay }: CalendarEventCardOneLineProps) {
  const inset = overlay === 'deadlineBadge' ? 'pr-12' : overlay === 'hideMenu' ? 'pr-8' : '';
  return (
    <div className={`flex min-w-0 items-baseline justify-between gap-2 ${inset}`}>
      <span className="truncate font-semibold text-content-primary">{title}</span>
      <span className="flex-shrink-0 whitespace-nowrap text-xs text-content-secondary">{time}</span>
    </div>
  );
}
