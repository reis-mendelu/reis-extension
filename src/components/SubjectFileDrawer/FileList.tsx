/**
 * File List Component
 * 
 * Renders the file grid with selection support.
 */

import { useState } from 'react';
import { Folder, Download, PanelRightOpen, StickyNote } from 'lucide-react';
import type { FileListProps } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { useDocumentNoteKeys } from '../../hooks/data/useDocumentNoteKeys';
import { parseIsDate } from './utils/fileDate';
import { ISBacklink } from './ISBacklink';
import { DocumentNoteEditor } from './DocumentNoteEditor';

const typeBadgeConfig: Record<string, string> = {
    pdf: 'badge-error',
    xls: 'badge-success', xlsx: 'badge-success', csv: 'badge-success',
    ppt: 'badge-warning', pptx: 'badge-warning',
    doc: 'badge-info', docx: 'badge-info', txt: 'badge-info', rtf: 'badge-info',
    zip: 'badge-warning badge-outline', rar: 'badge-warning badge-outline', '7z': 'badge-warning badge-outline',
};

function FileTypeBadge({ type }: { type: string }) {
    const label = type === 'unknown' ? 'FILE' : type.toUpperCase();
    const cls = typeBadgeConfig[type] || 'badge-ghost';
    return <span className={`badge badge-sm font-mono text-[10px] ${cls}`}>{label}</span>;
}

function isPdfFile(subFile: { link: string; type: string }): boolean {
    return subFile.type === 'pdf' || subFile.link.toLowerCase().endsWith('.pdf');
}

function isNewSinceVisit(date: string, lastVisitedAt: number | null | undefined): boolean {
    if (typeof lastVisitedAt !== 'number') return false;
    const d = parseIsDate(date);
    if (!d) return false;
    const lastDay = new Date(lastVisitedAt);
    lastDay.setHours(0, 0, 0, 0);
    return d.getTime() > lastDay.getTime();
}

export function FileList({
    groups,
    selectedIds,
    courseCode,
    fileRefs,
    ignoreClickRef,
    onToggleSelect,
    onOpenFile,
    onViewPdf,
    onDownloadSingle,
    folderUrl,
    lastVisitedAt
}: FileListProps) {
    const { t, language } = useTranslation();
    const { noteKeys } = useDocumentNoteKeys(courseCode);
    const [expandedLink, setExpandedLink] = useState<string | null>(null);

    if (groups.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400 italic">
                {t('course.footer.noFiles')}
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {groups.map(group => (
                <div key={group.name} className="space-y-3">
                    <div className="flex items-center gap-2 px-2 text-sm font-semibold text-base-content/50 uppercase tracking-wider">
                        <Folder size={14} />
                        {group.displayName}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                        {group.files.map((file, i) => (
                            <div key={i} className="space-y-1">
                                {file.files.map((subFile, j) => {
                                    const isSelected = selectedIds.includes(subFile.link);
                                    return (
                                        <div key={subFile.link} className="space-y-1">
                                        <div
                                            ref={el => {
                                                if (el) {
                                                    fileRefs.current.set(subFile.link, el);
                                                } else {
                                                    fileRefs.current.delete(subFile.link);
                                                }
                                            }}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (ignoreClickRef.current) return;
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    if (e.ctrlKey || e.metaKey) {
                                                        onToggleSelect(subFile.link, e as any);
                                                    } else if (isPdfFile(subFile) && onViewPdf) {
                                                        onViewPdf(subFile.link);
                                                    } else {
                                                        onOpenFile(subFile.link);
                                                    }
                                                }
                                            }}
                                            onClick={(e) => {
                                                if (ignoreClickRef.current) return;
                                                if (e.ctrlKey || e.metaKey) {
                                                    onToggleSelect(subFile.link, e);
                                                } else if (isPdfFile(subFile) && onViewPdf) {
                                                    onViewPdf(subFile.link);
                                                } else {
                                                    onOpenFile(subFile.link);
                                                }
                                            }}
                                            className={`
                                                flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-sm
                                                focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
                                                ${isSelected 
                                                    ? 'bg-primary/10 border-primary/20 shadow-sm' 
                                                    : 'bg-base-100 border-transparent hover:bg-base-200/50 hover:border-base-300'
                                                }
                                            `}
                                        >
                                            <input 
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => onToggleSelect(subFile.link, e as any)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="checkbox checkbox-xs checkbox-primary interactive shrink-0"
                                            />
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium truncate flex items-center gap-2 ${isSelected ? 'text-primary' : 'text-base-content'}`}>
                                                    <span className="truncate">{file.files.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name}</span>
                                                    {isNewSinceVisit(file.date, lastVisitedAt) && (
                                                        <span className="badge badge-primary badge-xs font-bold shrink-0">{t('course.freshness.newBadge')}</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-base-content/50 truncate flex items-center gap-2">
                                                    {file.date && <span className="shrink-0">{file.date}</span>}
                                                    {file.file_comment && <span className="truncate">{file.file_comment}</span>}
                                                </div>
                                            </div>
 
                                            <div className="flex items-center gap-1">
                                                {(() => {
                                                    const hasNote = noteKeys.has(subFile.link);
                                                    const isExpanded = expandedLink === subFile.link;
                                                    return (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedLink(isExpanded ? null : subFile.link);
                                                            }}
                                                            className={`btn btn-ghost btn-xs btn-square ${hasNote || isExpanded ? 'text-primary hover:text-primary' : 'text-base-content/40 hover:text-base-content/70'}`}
                                                            title={hasNote ? t('course.documentNote.edit') : t('course.documentNote.add')}
                                                        >
                                                            <StickyNote size={14} className={hasNote ? 'fill-primary/15' : ''} />
                                                        </button>
                                                    );
                                                })()}
                                                {onDownloadSingle && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDownloadSingle(subFile.link);
                                                        }}
                                                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content/70"
                                                        title={t('course.footer.download') || 'Download'}
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                )}
                                                {isPdfFile(subFile) && onViewPdf && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onViewPdf(subFile.link);
                                                        }}
                                                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-primary"
                                                        title={t('course.footer.openInSidebar') || 'Open in Sidebar'}
                                                    >
                                                        <PanelRightOpen size={14} />
                                                    </button>
                                                )}
                                                <FileTypeBadge type={subFile.type} />
                                            </div>
                                        </div>
                                            {expandedLink === subFile.link && (
                                                <div
                                                    className="px-2 pb-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <DocumentNoteEditor
                                                        courseCode={courseCode}
                                                        fileLink={subFile.link}
                                                        fileName={file.files.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name}
                                                        onClose={() => setExpandedLink(null)}
                                                    />
                                                </div>
                                            )}
                                    </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {folderUrl && (
                <ISBacklink
                    href={folderUrl.includes('?') ? `${folderUrl};lang=${language === 'cz' ? 'cz' : 'en'}` : `${folderUrl}?lang=${language === 'cz' ? 'cz' : 'en'}`}
                />
            )}
        </div>
    );
}

/**
 * File List Loading Skeleton
 */
export function FileListSkeleton() {
    return (
        <div className="p-6 space-y-8">
            {[1, 2].map((i) => (
                <div key={i} className="space-y-3">
                    {/* Folder Header Skeleton */}
                    <div className="flex items-center gap-2 px-2">
                        <div className="skeleton w-4 h-4 rounded-full bg-slate-200"></div>
                        <div className="skeleton h-4 w-32 rounded bg-slate-200"></div>
                    </div>
                    {/* Files Grid Skeleton */}
                    <div className="grid grid-cols-1 gap-1">
                        {[1, 2, 3].map((j) => (
                            <div key={j} className="flex items-center gap-3 p-3 rounded-lg border border-transparent bg-base-100">
                                <div className="skeleton w-5 h-5 rounded bg-base-300"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-3/4 rounded bg-base-300"></div>
                                    <div className="skeleton h-3 w-1/2 rounded bg-base-300"></div>
                                </div>
                                <div className="skeleton w-4 h-4 rounded bg-base-300"></div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
