import { FileCheck2, FileText, ScrollText, Loader2, Check, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUserParams } from '../../hooks/useUserParams';
import { useTranslation } from '../../hooks/useTranslation';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { STUDY_DOCUMENTS, buildDocumentUrl, buildZadostUrl } from '../../api/studyDocuments';
import { useDocumentDownload, type DownloadStatus } from '../../hooks/data/useDocumentDownload';

const ICONS: Record<string, typeof FileText> = {
  'potvrzeni-cz': FileCheck2, 'potvrzeni-en': FileCheck2,
  'prehled-cz': FileText, 'prehled-en': FileText, 'reg-arch': ScrollText,
};

function StatusIcon({ status }: { status: DownloadStatus }) {
  if (status === 'loading') return <Loader2 className="w-4 h-4 animate-spin" aria-label="loading" />;
  if (status === 'done') return <Check className="w-4 h-4 text-success" aria-label="done" />;
  if (status === 'error') return <AlertTriangle className="w-4 h-4 text-error" aria-label="error" />;
  return null;
}

/** Documents panel opened from the Student flyout. Self-connects to the store. */
export function DocumentsDrawer() {
  const { t } = useTranslation();
  const isOpen = useAppStore(s => s.isDocumentsOpen);
  const setOpen = useAppStore(s => s.setIsDocumentsOpen);
  const language = useAppStore(s => s.language);
  const { params } = useUserParams();
  const sid = params?.studium ?? '';
  const { status, run } = useDocumentDownload();

  return (
    <AdaptiveDrawer open={isOpen} onClose={() => setOpen(false)} width="sm:w-[460px]" title={t('documents.title')}>
      {/* Header — AdaptiveDrawer's `title` prop only surfaces as a sr-only a11y
          label on the mobile sheet; desktop needs a real visible heading +
          close affordance, so render one explicitly (mirrors EduroamDrawer). */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-base-300">
        <div className="w-11 h-11 rounded-box bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{t('documents.title')}</h3>
        </div>
        <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="btn btn-ghost btn-xs btn-circle">
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-1 p-3">
        {STUDY_DOCUMENTS.map(doc => {
          const Icon = ICONS[doc.id] ?? FileText;
          const st = status[doc.id] ?? 'idle';
          return (
            <button
              key={doc.id}
              disabled={!sid || st === 'loading'}
              onClick={() => run(doc.id, buildDocumentUrl(sid, doc), doc.filename)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-base-200 disabled:opacity-50 transition-colors text-left"
            >
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <span className="flex-1 font-medium">{t(`documents.items.${doc.labelKey}`)}</span>
              <StatusIcon status={st} />
            </button>
          );
        })}
        <a
          href={sid ? buildZadostUrl(sid, language) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!sid}
          className={`flex items-center gap-3 px-3 py-2.5 mt-1 border-t border-base-300 rounded-lg text-sm text-base-content/70 hover:bg-base-200 transition-colors ${!sid ? 'pointer-events-none opacity-50' : ''}`}
        >
          <ScrollText className="w-5 h-5 shrink-0" />
          <span className="flex-1 font-medium">{t('documents.items.zadost')}</span>
          <ExternalLink className="w-3.5 h-3.5 text-base-content/40" />
        </a>
      </div>
    </AdaptiveDrawer>
  );
}
