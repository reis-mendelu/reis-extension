import { BookOpen, ClipboardList, Clock, ExternalLink, FilePlus } from 'lucide-react';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { useTranslation } from '../../hooks/useTranslation';
import { useBoxLabels } from '../SubmissionBoxes/useBoxLabels';

const TYPE_KEY: Record<DeadlineAlert['type'], string> = {
  'exam-reg-opens': 'deadlines.examRegOpens',
  'exam-reg': 'deadlines.examReg',
  assignment: 'deadlines.assignment',
  'assignment-new': 'newBox.kind',
  'cvicny-test': 'deadlines.cvicnyTest',
  'zaznamnik-points': 'zaznamnik.newPoints',
};

/** The slot's tint IS the urgency — green for a test that can be taken
 *  whenever, amber for a clock that is running out. */
const TINT: Record<DeadlineAlert['type'], string> = {
  'exam-reg-opens': 'bg-warning/10 text-warning',
  'exam-reg': 'bg-warning/10 text-warning',
  assignment: 'bg-warning/10 text-warning',
  'assignment-new': 'bg-info/10 text-info',
  'cvicny-test': 'bg-success/10 text-success',
  'zaznamnik-points': 'bg-success/10 text-success',
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
export function DeadlineAlertItem({
  alert,
  onOpenSubject,
}: {
  alert: DeadlineAlert;
  /** A row about a subject (new záznamník points, a new box) opens it in reIS. */
  onOpenSubject?: (alert: DeadlineAlert) => void;
}) {
  const { t } = useTranslation();
  const { shortDate } = useBoxLabels();

  const h = alert.hoursUntil !== undefined ? Math.floor(alert.hoursUntil) : null;
  // A new box is weeks away as often as not: its date, not a count of hours.
  const timeLabel =
    h !== null
      ? h < 1
        ? t('deadlines.lessThanHour')
        : t('deadlines.hoursLeft', { h })
      : alert.type === 'assignment-new' && alert.deadline
        ? t('odevzdavarny.until', { date: shortDate(alert.deadline) })
        : null;
  const kind = t(TYPE_KEY[alert.type]);
  const isCvicny = alert.type === 'cvicny-test';
  const isNewBox = alert.type === 'assignment-new';
  // "Nová odevzdávárna · " left a 320px phone no room for the box's own name,
  // the one thing the row is about. The icon and the section say the rest.
  const lead = isNewBox ? t('newBox.badge') : kind;

  const body = (
    <>
      {/* Same 32px slot the notification rows give the society's logo, so the
          two kinds share one left edge — that alignment was the whole
          complaint. A rail would have been quieter, but it cannot hold a logo,
          and the row beside this one has to. */}
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${TINT[alert.type]}`}
      >
        {alert.type === 'zaznamnik-points' ? (
          <ClipboardList size={16} />
        ) : isNewBox ? (
          <FilePlus size={16} />
        ) : isCvicny ? (
          <BookOpen size={16} />
        ) : (
          <Clock size={16} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-md font-bold text-base-content">{alert.title}</span>
        <span className="truncate text-2sm text-base-content/60">
          {/* Only when the meta column is showing a time instead. A practice
              test has no clock, so its kind IS its meta, and prefixing the
              subtitle with it too printed "Cvičný test" three times in one
              row — the label, the subtitle and the test's own name. */}
          {isNewBox && <span className="sr-only">{kind}: </span>}
          {timeLabel ? `${lead} · ${alert.body}` : alert.body}
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

  if (alert.courseCode && onOpenSubject) {
    return (
      <button
        type="button"
        onClick={() => onOpenSubject(alert)}
        className={`${shell} w-full text-left`}
      >
        {body}
      </button>
    );
  }

  if (!alert.link) return <div className={shell}>{body}</div>;

  return (
    <a href={alert.link} target="_blank" rel="noreferrer" className={`${shell} text-left`}>
      {body}
    </a>
  );
}
