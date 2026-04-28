import { useState, useMemo } from 'react';
import { FileText, Eye, ExternalLink, Loader2 } from 'lucide-react';
import type { SkmDocument } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { PdfViewer } from '../SubjectFileDrawer/PdfViewer';

interface Props {
    documents: SkmDocument[];
    language: IskamLanguage;
}

type GroupKey = 'cenik' | 'harmonogram' | 'rady' | 'ostatni';

const GROUP_ORDER: GroupKey[] = ['cenik', 'harmonogram', 'rady', 'ostatni'];

function groupOf(label: string): GroupKey {
    if (/^ceník|^stanovení cen/i.test(label)) return 'cenik';
    if (/^harmonogram/i.test(label)) return 'harmonogram';
    if (/řád|pravidla|postup/i.test(label)) return 'rady';
    return 'ostatni';
}

const COLLAPSED = 5;

export function SkmDocumentsSection({ documents, language }: Props) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loadingHref, setLoadingHref] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const { openPdfInline } = useFileActions();
    const t = createIskamT(language);

    const sorted = useMemo(() => {
        const studentPriority = (label: string) => /pro studenty/i.test(label) ? 0 : 1;
        return [...documents].sort((a, b) => {
            const ga = GROUP_ORDER.indexOf(groupOf(a.label));
            const gb = GROUP_ORDER.indexOf(groupOf(b.label));
            if (ga !== gb) return ga - gb;
            if (ga === GROUP_ORDER.indexOf('cenik')) {
                const pa = studentPriority(a.label);
                const pb = studentPriority(b.label);
                if (pa !== pb) return pa - pb;
            }
            return a.label.localeCompare(b.label, 'cs');
        });
    }, [documents]);

    const handlePreview = async (href: string) => {
        setLoadingHref(href);
        console.log('[SKM] openPdfInline start:', href);
        const blobUrl = await openPdfInline(href);
        console.log('[SKM] openPdfInline result:', blobUrl);
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
            <>
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-8" onClick={closePreview}>
                    <div className="bg-base-100 rounded-xl shadow-2xl flex flex-col w-full h-full max-w-5xl" onClick={e => e.stopPropagation()}>
                        <PdfViewer blobUrl={previewUrl} onClose={closePreview} />
                    </div>
                </div>
                {/* Keep section visible behind the overlay so layout doesn't shift */}
                <section aria-hidden="true" />
            </>
        );
    }

    const visible = expanded ? sorted : sorted.slice(0, COLLAPSED);

    const groupLabel: Record<GroupKey, string> = {
        cenik: t('iskam.documents.groupCenik'),
        harmonogram: t('iskam.documents.groupHarmonogram'),
        rady: t('iskam.documents.groupRady'),
        ostatni: t('iskam.documents.groupOstatni'),
    };

    return (
        <section>
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest px-1 mb-2">
                {t('iskam.documents.title')}
            </h3>
            <div className="card bg-base-100 border border-base-200">
                <div className="divide-y divide-base-200">
                    {visible.map((doc, i) => {
                        const group = groupOf(doc.label);
                        const prevGroup = i > 0 ? groupOf(visible[i - 1].label) : null;
                        const showHeader = expanded && group !== prevGroup;
                        return (
                            <div key={doc.href}>
                                {showHeader && (
                                    <div className="px-3 py-1 bg-base-200/60 text-xs font-semibold text-base-content/40 uppercase tracking-wider">
                                        {groupLabel[group]}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 px-3 py-2">
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
                            </div>
                        );
                    })}
                </div>
                {sorted.length > COLLAPSED && (
                    <button
                        className="btn btn-xs btn-ghost w-full text-base-content/40 rounded-t-none border-t border-base-200"
                        onClick={() => setExpanded(e => !e)}
                    >
                        {expanded ? '↑' : t('iskam.documents.moreDocs', { n: sorted.length - COLLAPSED })}
                    </button>
                )}
            </div>
        </section>
    );
}
