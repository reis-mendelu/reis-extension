import { useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReportAttachmentsState } from './useReportAttachments';

interface Props {
  state: ReportAttachmentsState;
  /** Desktop only: a phone has no clipboard shortcut to advertise. */
  showPasteHint: boolean;
}

function time(t: number): string {
  return new Date(t).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ReportAttachments({ state, showPasteHint }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const d = state.diagnostics;
  const listLabel = t('feedback.attachDiagnostics') as string;

  return (
    <div className="space-y-3" data-testid="report-attachments">
      {/* Screenshot */}
      <div className="flex flex-wrap items-center gap-2">
        {state.screenshot ? (
          <div className="flex items-center gap-2">
            <img
              src={state.screenshot.previewUrl}
              alt={t('feedback.screenshotAlt') as string}
              className="h-14 w-auto max-w-[6rem] rounded-md border border-base-300 object-cover"
            />
            <span className="text-xs text-base-content/70">
              {Math.round(state.screenshot.bytes / 1024)} kB
            </span>
            <button
              type="button"
              onClick={state.removeScreenshot}
              aria-label={t('feedback.removeScreenshot') as string}
              className="btn btn-xs btn-ghost btn-circle text-base-content/75"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="btn btn-sm border-0 bg-base-200 text-base-content/75 hover:bg-base-300 hover:text-base-content gap-2">
            {state.encoding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            {t('feedback.attachScreenshot')}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label={t('feedback.attachScreenshot') as string}
              onChange={(e) => {
                void state.attachFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
        {!state.screenshot && showPasteHint && (
          <span className="text-xs text-base-content/70">{t('feedback.screenshotPasteHint')}</span>
        )}
      </div>
      {state.encodeFailed && (
        <p className="text-xs text-error" role="alert">
          {t('feedback.screenshotFailed')}
        </p>
      )}

      {/* Technical details */}
      <div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary mt-0.5"
            checked={state.includeDiagnostics}
            onChange={(e) => void state.toggleDiagnostics(e.target.checked)}
          />
          <span className="text-sm text-base-content">
            {t('feedback.attachDiagnostics')}
            <span className="block text-xs text-base-content/70">
              {t('feedback.diagnosticsHint')}
            </span>
          </span>
        </label>
        {state.includeDiagnostics && d && (
          <div className="mt-2 ml-7">
            <button
              type="button"
              className="btn btn-xs btn-ghost px-1 text-base-content underline underline-offset-2"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? t('feedback.hideDiagnostics')
                : t('feedback.showDiagnostics', { count: d.entries.length })}
            </button>
            {expanded && (
              <div className="mt-1 rounded-lg bg-base-200 p-2 text-[11px] leading-snug text-base-content/80">
                <p className="break-words">
                  {d.env.platform} · {d.env.os} · {d.env.lang} ·{' '}
                  {d.env.online ? 'online' : 'offline'} · sync {d.sync.schedule}/{d.sync.exams}
                </p>
                {d.entries.length === 0 ? (
                  <p className="mt-1">{t('feedback.noDiagnostics')}</p>
                ) : (
                  <ul aria-label={listLabel} className="mt-1 max-h-40 overflow-y-auto space-y-1">
                    {d.entries.map((e, i) => (
                      <li key={`${e.t}-${i}`} className="flex items-start gap-1">
                        <span className="min-w-0 flex-1 break-words font-mono">
                          {/* The dot carries the colour: red text on base-200 fails AA in the
                              light theme, and the word must stay readable. */}
                          <span
                            aria-hidden="true"
                            className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-1 ${
                              e.level === 'error' ? 'bg-error' : 'bg-warning'
                            }`}
                          />
                          <span className="font-semibold">{e.level}</span> {time(e.t)} {e.source}{' '}
                          {e.ctx ?? ''} {e.status ?? ''} {e.msg}
                        </span>
                        <button
                          type="button"
                          onClick={() => state.removeEntry(i)}
                          aria-label={t('feedback.removeLine') as string}
                          className="btn btn-xs btn-ghost btn-circle shrink-0 min-h-0 h-5 w-5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
