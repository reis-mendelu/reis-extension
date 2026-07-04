import { createPortal } from 'react-dom';
import { X, ShieldCheck, Printer, FileText, ExternalLink, Info } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { STUDY_DOCUMENTS, type StudyDocumentSection } from '../../data/studyDocuments';
import { injectUserParams } from '../../data/pages/types';

const STORAGE_URL = 'https://is.mendelu.cz/auth/uloziste/index.pl?rezim=2;lang={{lang}}';

interface StudyDocumentsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for printing/downloading IS Mendelu study documents (Potvrzení o studiu,
 * Přehled studia, …). Mirrors the two sections of `student/tisk_dokumentu.pl`.
 * Behaves like IsPortalPopover: each row opens the IS link in a new tab, where
 * the session cookie is present.
 */
export function StudyDocumentsPopover({ isOpen, onClose }: StudyDocumentsPopoverProps) {
  const { t, language } = useTranslation();
  const studiumId = useAppStore(s => s.studiumId);
  const lang = language === 'en' ? 'en' : 'cz';

  if (!isOpen) return null;

  const open = (href: string) => {
    if (!studiumId) return;
    window.open(injectUserParams(href, studiumId, lang), '_blank');
  };

  const docsIn = (section: StudyDocumentSection) => STUDY_DOCUMENTS.filter(d => d.section === section);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-base-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-base-200">
          <h2 className="font-bold text-lg text-base-content">{t('studyDocs.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-base-200 rounded-xl transition-colors text-base-content/50 hover:text-base-content"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!studiumId ? (
          <div className="py-10 px-5 text-center text-sm text-base-content/50">
            {t('studyDocs.unavailable')}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
            {/* E-sealed section */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-base-content">{t('studyDocs.sealedTitle')}</h3>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-base-content/50 pl-0.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>{t('studyDocs.sealedHint')}</span>
              </p>
              <ul className="flex flex-col gap-1">
                {docsIn('sealed').map(doc => (
                  <DocRow key={doc.id} label={doc.label[lang === 'cz' ? 'cs' : 'en']} onClick={() => open(doc.href)} />
                ))}
              </ul>
              <button
                onClick={() => open(STORAGE_URL)}
                className="self-start text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 pl-0.5 pt-0.5"
              >
                <ExternalLink className="w-3 h-3" />
                {t('studyDocs.storageLink')}
              </button>
            </section>

            {/* Plain print section */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-base-content/70" />
                <h3 className="font-bold text-sm text-base-content">{t('studyDocs.plainTitle')}</h3>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-base-content/50 pl-0.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>{t('studyDocs.plainHint')}</span>
              </p>
              <ul className="flex flex-col gap-1">
                {docsIn('plain').map(doc => (
                  <DocRow key={doc.id} label={doc.label[lang === 'cz' ? 'cs' : 'en']} onClick={() => open(doc.href)} />
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function DocRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-base-200/40 hover:bg-base-200 border border-base-300/50 hover:border-primary/30 transition-colors text-left group"
      >
        <FileText className="w-4 h-4 text-base-content/40 group-hover:text-primary shrink-0" />
        <span className="text-sm text-base-content/90 flex-1 truncate">{label}</span>
        <ExternalLink className="w-3.5 h-3.5 text-base-content/30 group-hover:text-primary shrink-0" />
      </button>
    </li>
  );
}
