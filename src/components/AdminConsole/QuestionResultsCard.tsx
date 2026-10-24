import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import type { QuestionResult } from '../../api/adminQuestions';
import { dailyTable, questionStats, questionStatus } from './questionStats';

const pct = (x: number | null, lang: string) =>
  x === null
    ? '–'
    : new Intl.NumberFormat(lang === 'cz' ? 'cs' : 'en', {
        style: 'percent',
        maximumFractionDigits: 0,
      }).format(x);

const STATUS_BADGE = {
  live: 'badge-success',
  scheduled: 'badge-outline',
  ended: 'badge-ghost',
} as const;

/**
 * One question's results: devices that saw it, and for each button its count,
 * its share of those who saw it, and its share of the answers. This is also
 * the satisfaction view the console lacked since the reis-admin merge.
 */
export function QuestionResultsCard({ q }: { q: QuestionResult }) {
  const { t, language } = useTranslation();
  const end = useAppStore((s) => s.endAdminQuestion);
  const status = questionStatus(q);
  const s = questionStats(q);
  const daily = dailyTable(q);
  const when = (iso: string) =>
    new Date(iso).toLocaleString(language === 'cz' ? 'cs' : 'en', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-100 p-3">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-base-content">{q.promptCz}</p>
        <span className={`badge badge-sm ${STATUS_BADGE[status]}`}>
          {t(`admin.questions.${status}`)}
        </span>
      </div>
      <p className="text-xs text-base-content/70">
        {when(q.startsAt)} – {when(q.endsAt)}
        {q.faculties && ` · ${q.faculties.map((f) => f.toUpperCase()).join(', ')}`}
      </p>
      <p className="text-xs text-base-content">
        {t('admin.questions.seen', { n: s.seen })} ·{' '}
        {t('admin.questions.answered', { n: s.answered })}
      </p>
      <ul className="flex flex-col gap-1.5">
        {s.buttons.map((b) => (
          <li key={b.key} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2 text-xs text-base-content">
              <span className="font-medium">
                {b.cz}
                {b.isLink && ` (${t('admin.questions.clicked')})`}
              </span>
              <span className="tabular-nums">
                {b.n} · {t('admin.questions.ofSeen', { pct: pct(b.ofSeen, language) })}
                {!b.isLink &&
                  ` · ${t('admin.questions.ofAnswered', { pct: pct(b.ofAnswered, language) })}`}
              </span>
            </div>
            {/* An answer's bar is its share of the answers, so a 1–5 spread reads;
                a link's is its share of those who saw it. */}
            <progress
              className="progress progress-primary h-1.5 w-full"
              value={b.n}
              max={Math.max(b.isLink ? s.seen : s.answered, 1)}
            />
          </li>
        ))}
      </ul>
      {s.suspicious && (
        <p
          role="alert"
          className="rounded bg-warning/20 px-2 py-1 text-xs font-medium text-base-content"
        >
          {t('admin.questions.suspicious')}
        </p>
      )}
      {daily.rows.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-base-content/70">
            {t('admin.questions.daily')}
          </summary>
          <table className="table table-xs mt-1">
            <thead>
              <tr>
                <th>{t('admin.questions.day')}</th>
                {daily.keys.map((k) => (
                  <th key={k}>
                    {k === 'seen' ? '👁' : (q.buttons.find((b) => b.key === k)?.cz ?? k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.rows.map((r) => (
                <tr key={r.day}>
                  <td>{r.day}</td>
                  {r.counts.map((n, i) => (
                    <td key={daily.keys[i]} className="tabular-nums">
                      {n}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {status !== 'ended' && (
        <button
          type="button"
          className="btn btn-outline btn-xs self-end"
          onClick={async () => {
            if (!(await end(q))) toast.error(t('admin.questions.endError'));
          }}
        >
          {t('admin.questions.end')}
        </button>
      )}
    </div>
  );
}
