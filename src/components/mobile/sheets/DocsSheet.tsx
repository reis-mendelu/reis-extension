import {
  FileCheck2,
  FileText,
  ScrollText,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  STUDY_DOCUMENTS,
  buildDocumentUrl,
  buildFallbackDocumentUrl,
  buildZadostUrl,
} from '../../../api/studyDocuments';
import { useDocumentDownload, type DownloadStatus } from '../../../hooks/data/useDocumentDownload';

export interface DocsSheetProps {
  onClose: () => void;
}

const ICONS: Record<string, typeof FileText> = {
  'potvrzeni-cz': FileCheck2,
  'potvrzeni-en': FileCheck2,
  'prehled-cz': FileText,
  'prehled-en': FileText,
  'reg-arch': ScrollText,
};

function StatusIcon({ status }: { status: DownloadStatus }) {
  const { t } = useTranslation();
  if (status === 'loading')
    return <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-base-content/50" />;
  if (status === 'done') return <Check className="h-4 w-4 flex-shrink-0 text-success" />;
  if (status === 'error')
    // Named, not mute. A bare triangle said only "something", and there was no
    // way to find out what — "I can't click the warning or anything to see what
    // it's about". The toast raised at the moment of failure carries the
    // sentence; this carries it for anyone arriving at the row afterwards, and
    // for a screen reader, which had nothing at all.
    // The title sits on a wrapper: lucide's props do not include `title`, and
    // an svg <title> child is not what a long-press tooltip reads.
    return (
      <span
        role="img"
        aria-label={t('documents.downloadFailed')}
        title={t('documents.downloadFailed')}
        className="flex-shrink-0"
      >
        <AlertTriangle className="h-4 w-4 text-error" />
      </span>
    );
  return null;
}

/**
 * Container sheet for the official study documents (prototype lines 546-559):
 * one-tap PDF downloads with the university's electronic seal. Reuses the
 * desktop `DocumentsDrawer`'s data and download plumbing wholesale
 * (`STUDY_DOCUMENTS`, `buildDocumentUrl`, `useDocumentDownload`) — only the
 * row layout is phone-specific.
 */
export function DocsSheet({ onClose }: DocsSheetProps) {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const sid = useAppStore((s) => s.studiumId) ?? '';
  const { status, run } = useDocumentDownload();

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        title={t('documents.title')}
        subtitle={t('documents.sheetSubtitle')}
        onClose={onClose}
      />
      <div className="flex flex-col gap-2 px-4 pb-6">
        {STUDY_DOCUMENTS.map((doc) => {
          const Icon = ICONS[doc.id] ?? FileText;
          const st = status[doc.id] ?? 'idle';
          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-field border border-base-content/10 px-3 py-2.5"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-error/10 text-error">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-md font-medium">
                {t(`documents.items.${doc.labelKey}`)}
              </span>
              <StatusIcon status={st} />
              <button
                type="button"
                disabled={!sid || st === 'loading'}
                onClick={() =>
                  run(
                    doc.id,
                    buildDocumentUrl(sid, doc),
                    doc.filename,
                    buildFallbackDocumentUrl(sid, doc)
                  )
                }
                className="btn btn-primary btn-xs flex-shrink-0"
              >
                {t('common.download')}
              </button>
            </div>
          );
        })}
        <a
          href={sid ? buildZadostUrl(sid, language) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!sid}
          className={`mt-1 flex items-center gap-3 border-t border-base-300 px-3 py-2.5 text-base text-base-content/70 ${!sid ? 'pointer-events-none opacity-50' : ''}`}
        >
          <ScrollText className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 font-medium">{t('documents.items.zadost')}</span>
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-base-content/40" />
        </a>
      </div>
    </Sheet>
  );
}
