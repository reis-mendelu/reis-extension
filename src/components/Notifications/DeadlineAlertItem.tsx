import { ExternalLink } from 'lucide-react';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { useTranslation } from '../../hooks/useTranslation';

const TYPE_KEY: Record<DeadlineAlert['type'], string> = {
  'exam-reg-opens': 'deadlines.examRegOpens',
  'exam-reg': 'deadlines.examReg',
  'assignment': 'deadlines.assignment',
  'cvicny-test': 'deadlines.cvicnyTest',
};

/** The rail's colour IS the urgency — green for a test that can be taken
 *  whenever, amber for a clock that is running out. */
const RAIL: Record<DeadlineAlert['type'], string> = {
  'exam-reg-opens': 'bg-warning',
  'exam-reg': 'bg-warning',
  'assignment': 'bg-warning',
  'cvicny-test': 'bg-success',
};

/**
 * One deadline in the Novinky feed, built on the same row as `ExamRowCard`:
 * accent rail, title over muted subtitle, one line of meta on the right. It
 * used to be a flush-left 16px glyph, three text sizes and a DaisyUI
 * `badge-outline` — an idiom that appears nowhere else in reIS — stacked
 * directly against `NotificationItem`'s 40px circle avatar. Two row designs in
 * one `divide-y` list is what read as "weirdly aligned, strange design", and
 * the alignment was literally that: one row's text started 48px right of the
 * next one's.
 *
 * The kind ("Odevzdávárna") leads the subtitle rather than taking a second
 * meta line. As a second line it cost the right column ~100px, and since the
 * title here is a COURSE name — not `ExamRowCard`'s short "Zkouška" — that
 * truncated "Algoritmizace a programování" to "Algoritmizace …" at 320px. It
 * is also the row's least specific token: the rail already separates a test
 * from a deadline, and the subtitle names the actual piece of work.
 *
 * The whole row is the link now. The only way into an assignment was a 14px
 * icon in the corner — well under the 44px touch minimum, on the surface most
 * likely to be used one-handed on a phone.
 */
export function DeadlineAlertItem({ alert }: { alert: DeadlineAlert }) {
  const { t } = useTranslation();

  const h = alert.hoursUntil !== undefined ? Math.floor(alert.hoursUntil) : null;
  const timeLabel =
    h !== null ? (h < 1 ? t('deadlines.lessThanHour') : t('deadlines.hoursLeft', { h })) : null;
  const kind = t(TYPE_KEY[alert.type]);

  const body = (
    <>
      <span className={`h-8 w-1 flex-shrink-0 rounded-full ${RAIL[alert.type]}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-md font-bold text-base-content">{alert.title}</span>
        <span className="truncate text-2sm text-base-content/60">
          {/* Only when the meta column is showing a time instead. A practice
              test has no clock, so its kind IS its meta, and prefixing the
              subtitle with it too printed "Cvičný test" three times in one
              row — the label, the subtitle and the test's own name. */}
          {timeLabel ? `${kind} · ${alert.body}` : alert.body}
        </span>
      </span>
      {/* Bold base-content, not `text-warning`. Amber on the light theme's
          base-100 measures 2.15:1 — it fails AA by more than half, and no
          weight rescues it at this size. The colour belongs on the rail, which
          is a solid block rather than a sentence, so the row keeps its urgency
          signal and the words stay readable. */}
      <span className="flex-shrink-0 whitespace-nowrap text-2sm font-bold text-base-content">
        {timeLabel ?? kind}
      </span>
      {alert.link && (
        <ExternalLink size={14} className="flex-shrink-0 text-base-content/40" aria-hidden />
      )}
    </>
  );

  const shell =
    'flex items-center gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5';

  if (!alert.link) return <div className={shell}>{body}</div>;

  return (
    <a href={alert.link} target="_blank" rel="noreferrer" className={`${shell} text-left`}>
      {body}
    </a>
  );
}
