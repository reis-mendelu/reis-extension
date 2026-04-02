/**
 * File List Component
 * 
 * Renders the file grid with selection support.
 */

import { useState } from 'react';
import { Folder, Check, ExternalLink, PanelRightOpen, StickyNote } from 'lucide-react';
import type { FileListProps } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { useDocumentNoteKeys } from '../../hooks/data/useDocumentNoteKeys';
import { DocumentNote } from './DocumentNote';

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

export function FileList({
    groups,
    selectedIds,
    courseCode,
    fileRefs,
    ignoreClickRef,
    onToggleSelect,
    onOpenFile,
    onViewPdf,
    folderUrl
}: FileListProps) {
    const { t, language } = useTranslation();
    const [expandedNoteLink, setExpandedNoteLink] = useState<string | null>(null);
    const { noteKeys, updateKey } = useDocumentNoteKeys(courseCode);

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
                                            ref={el => { if (el) fileRefs.current.set(subFile.link, el); }}
                                            onClick={(e) => {
                                                if (ignoreClickRef.current) return;
                                                if (e.ctrlKey || e.metaKey) {
                                                    onToggleSelect(subFile.link, e);
                                                } else {
                                                    onOpenFile(subFile.link);
                                                }
                                            }}
                                            className={`
                                                flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-sm
                                                ${isSelected 
                                                    ? 'bg-primary/10 border-primary/20 shadow-sm' 
                                                    : 'bg-base-100 border-transparent hover:bg-base-200/50 hover:border-base-300'
                                                }
                                            `}
                                        >
                                            <div 
                                                className={`
                                                    w-5 h-5 rounded border flex items-center justify-center transition-colors interactive
                                                    ${isSelected ? 'bg-primary border-primary' : 'border-base-content/30 group-hover:border-primary/50'}
                                                `}
                                                onClick={(e) => onToggleSelect(subFile.link, e)}
                                            >
                                                {isSelected && <Check size={12} className="text-primary-content" />}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium truncate ${isSelected ? 'text-primary' : 'text-base-content'}`}>
                                                    {file.files.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name}
                                                </div>
                                                {file.file_comment && (
                                                    <div className="text-xs text-base-content/50 truncate">{file.file_comment}</div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedNoteLink(prev => prev === subFile.link ? null : subFile.link);
                                                    }}
                                                    className="relative p-1.5 rounded-md hover:bg-base-300 text-base-content/40 hover:text-base-content/70 transition-colors focus:outline-none"
                                                    title={t('course.documentNote.add')}
                                                >
                                                    <StickyNote size={14} />
                                                    {noteKeys.has(subFile.link) && (
                                                        <span className="absolute top-1 right-1 w-[5px] h-[5px] rounded-full bg-primary" />
                                                    )}
                                                </button>
                                                {isPdfFile(subFile) && onViewPdf && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onViewPdf(subFile.link);
                                                        }}
                                                        className="p-1.5 rounded-md hover:bg-base-300 text-base-content/40 hover:text-primary transition-colors focus:outline-none"
                                                        title={t('course.footer.openInSidebar') || 'Open in Sidebar'}
                                                    >
                                                        <PanelRightOpen size={16} />
                                                    </button>
                                                )}
                                                <FileTypeBadge type={subFile.type} />
                                            </div>
                                        </div>
                                        {expandedNoteLink === subFile.link && (
                                            <DocumentNote courseCode={courseCode} fileLink={subFile.link} onNoteChange={updateKey} />
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
                <div className="flex justify-center pt-2 pb-2">
                    <a
                        href={folderUrl.includes('?') ? `${folderUrl};lang=${language === 'cz' ? 'cz' : 'en'}` : `${folderUrl}?lang=${language === 'cz' ? 'cz' : 'en'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm gap-2 text-base-content/50 hover:text-primary normal-case font-bold"
                    >
                        <span>IS MENDELU</span>
                        <ExternalLink size={16} />
                    </a>
                </div>
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
