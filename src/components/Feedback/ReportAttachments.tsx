import { ImagePlus, Loader2, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReportAttachmentsState } from './useReportAttachments';

interface Props {
  state: ReportAttachmentsState;
  /** Desktop only: a phone has no clipboard shortcut to advertise. */
  showPasteHint: boolean;
}

export function ReportAttachments({ state, showPasteHint }: Props) {
  const { t } = useTranslation();

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
            onChange={(e) => state.setIncludeDiagnostics(e.target.checked)}
          />
          <span className="text-sm text-base-content">
            {t('feedback.attachDiagnostics')}
            <span className="block text-xs text-base-content/70">
              {t('feedback.diagnosticsHint')}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
