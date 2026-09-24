import { ScreenSkeleton } from '../../primitives/ScreenSkeleton';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * What the calendar shows while the first crawl is still running.
 *
 * Its own file beside the screen's other parts, not because it is reused —
 * nothing else renders it — but because CalendarScreen had grown past the
 * 200-line convention and this was the one piece of it that answers a question
 * of its own.
 */
export function CalendarSkeleton() {
  const { t } = useTranslation();
  return (
    <ScreenSkeleton
      testId="calendar-skeleton"
      label={t('mobile.calendar.loading')}
      // One row shorter than it was, and no inset of its own: the header above
      // it is real now rather than a placeholder bar.
      rows={['h-28', 'h-10', 'h-20', 'h-20']}
      underHeader
    />
  );
}
