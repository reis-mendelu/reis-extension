import { useState } from 'react';
import { FileText, Eye, ExternalLink, Loader2 } from 'lucide-react';
import type { SkmDocument } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { PdfViewer } from '../SubjectFileDrawer/PdfViewer';

interface Props {
    documents: SkmDocument[];
    language: IskamLanguage;
}

const COLLAPSED = 5;

export function SkmDocumentsSection({ documents, language }: Props) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loadingHref, setLoadingHref] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const { openPdfInline } = useFileActions();
    const t = createIskamT(language);

    const handlePreview = async (href: string) => {
        setLoadingHref(href);
        const blobUrl = await openPdfInline(href);
        setLoadingHref(null);
        if (blobUrl) {
            setPreviewUrl(blobUrl);
        } else {
            window.open(href, '_blank');
        }
    };

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    if (previewUrl) {
        return (
            <div className="fixed inset-0 z-50 bg-base-100">
                <PdfViewer blobUrl={previewUrl} onClose={closePreview} />
            </div>
        );
    }

    const visible = expanded ? documents : documents.slice(0, COLLAPSED);

    return (
        <section>
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest px-1 mb-2">
                {t('iskam.documents.title')}
            </h3>
            <div className="card bg-base-100 border border-base-200">
                <div className="divide-y divide-base-200">
                    {visible.map(doc => (
                        <div key={doc.href} className="flex items-center gap-2 px-3 py-2">
                            <FileText size={13} className="text-base-content/40 shrink-0" />
                            <span className="text-xs text-base-content/80 flex-1 leading-snug">{doc.label}</span>
                            <button
                                className="btn btn-ghost btn-xs btn-square"
                                onClick={() => handlePreview(doc.href)}
                                disabled={loadingHref !== null}
                                aria-label="Preview"
                            >
                                {loadingHref === doc.href
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <Eye size={13} />}
                            </button>
                            <a
                                href={doc.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-xs btn-square"
                                aria-label="Open in new tab"
                            >
                                <ExternalLink size={13} />
                            </a>
                        </div>
                    ))}
                </div>
                {documents.length > COLLAPSED && (
                    <button
                        className="btn btn-xs btn-ghost w-full text-base-content/40 rounded-t-none border-t border-base-200"
                        onClick={() => setExpanded(e => !e)}
                    >
                        {expanded ? '↑' : t('iskam.documents.moreDocs', { n: documents.length - COLLAPSED })}
                    </button>
                )}
            </div>
        </section>
    );
}
