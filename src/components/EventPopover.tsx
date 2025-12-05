import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { X, Download, Loader2, FileText, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useSubjects } from '../hooks/data';
import { GetIdFromLink } from '../utils/calendarUtils';
import { getFilesFromId } from '../utils/apiUtils';
import { createLogger } from '../utils/logger';
import type { FileObject, StoredSubject, BlockLesson } from '../types/calendarTypes';

const log = createLogger('EventPopover');

interface EventPopoverProps {
    lesson: BlockLesson | null;
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement | null>;
}

// Helper to resolve final file URL
async function resolveFinalFileUrl(link: string): Promise<string> {
    link = link.replace(/\?;/g, '?').replace(/;/g, '&');

    if (link.includes('dokumenty_cteni.pl')) {
        try {
            const normalizedLink = link.replace(/;/g, '&').replace(/\?/g, '&');
            const idMatch = normalizedLink.match(/[&]id=(\d+)/);
            const dokMatch = normalizedLink.match(/[&]dok=(\d+)/);

            if (idMatch && dokMatch) {
                return `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${dokMatch[1]}&id=${idMatch[1]}&z=1`;
            }
        } catch (e) {
            log.warn('Failed to construct direct download URL', e);
        }
    }

    let fullUrl = '';
    if (link.startsWith('http')) {
        fullUrl = link;
    } else if (link.startsWith('/')) {
        fullUrl = `https://is.mendelu.cz${fullUrl}`;
    } else {
        fullUrl = `https://is.mendelu.cz/auth/dok_server/${link}`;
    }

    return fullUrl;
}

// Clean folder name - remove course code prefix
function cleanFolderName(name: string, courseCode?: string): string {
    let cleaned = name;
    // Remove default "Folder/Subfolder" prefix if present
    if (cleaned.includes('/')) {
        cleaned = cleaned.split('/')[1];
    }

    cleaned = cleaned.trim();

    // Remove course code prefix if present 
    // Logic: If course code is "EBC-TZI", remove "EBC-TZI" from "EBC-TZI Informace"
    if (courseCode) {
        // Handle "EBC-TZI" from "EBC-TZI" (remove QXX or other suffixes if present in courseCode passed prop)
        // Usually prop courseCode is just "EBC-TZI" or "EBC-TZI Q31"
        const codePrefix = courseCode.split(' ')[0];

        if (cleaned.toLowerCase().startsWith(codePrefix.toLowerCase())) {
            cleaned = cleaned.substring(codePrefix.length).trim();
            log.debug(`Cleaned folder name: '${name}' -> '${cleaned}' (removed prefix '${codePrefix}')`);
        }
    }

    return cleaned || name;
}

export function EventPopover({ lesson, isOpen, onClose, anchorRef }: EventPopoverProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const { getSubject, isLoaded: subjectsLoaded } = useSubjects();

    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [files, setFiles] = useState<FileObject[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [loadingFile, setLoadingFile] = useState(false);

    // Get subject data
    const subject: StoredSubject | null = useMemo(() => {
        if (!lesson) return null;
        const s = getSubject(lesson.courseCode);
        if (!s) return null;
        return { fullName: s.fullName, folderUrl: s.folderUrl };
    }, [getSubject, lesson]);

    // Calculate position - Side positioning preference
    useEffect(() => {
        if (isOpen && anchorRef.current && lesson) {
            log.debug(`Calculating position for lesson: ${lesson.courseCode}`);
            const anchor = anchorRef.current;
            const container = anchor.closest('.overflow-y-auto') as HTMLElement || document.body;

            const containerRect = container.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();

            const popupWidth = 350;
            const popupHeight = 400; // Estimated height for checking vertical fit
            const padding = 16;

            // Log dimensions for debugging
            log.debug('Dimensions', {
                container: { width: containerRect.width, height: containerRect.height, top: containerRect.top, left: containerRect.left },
                anchor: { width: anchorRect.width, height: anchorRect.height, top: anchorRect.top, left: anchorRect.left, right: anchorRect.right },
                popup: { width: popupWidth, height: popupHeight }
            });

            // Target: Right side of the anchor, vertically aligned with top
            let left = (anchorRect.right - containerRect.left) + 8;
            let top = (anchorRect.top - containerRect.top) + container.scrollTop;

            // Check if it fits on the RIGHT
            if (left + popupWidth > containerRect.width - padding) {
                log.debug('Not enough space on RIGHT, checking LEFT');
                // Try LEFT side
                const leftCandidate = (anchorRect.left - containerRect.left) - popupWidth - 8;

                if (leftCandidate > padding) {
                    left = leftCandidate;
                    log.debug('Placed on LEFT');
                } else {
                    // Fallback: Bottom or Overlay
                    log.debug('Not enough space on LEFT, falling back to BOTTOM/OVERLAY');
                    left = Math.max(padding, (anchorRect.left - containerRect.left));
                    // If near right edge of screen, shift left
                    if (left + popupWidth > containerRect.width - padding) {
                        left = containerRect.width - popupWidth - padding;
                    }
                    top = (anchorRect.bottom - containerRect.top) + container.scrollTop + 4;
                }
            } else {
                log.debug('Placed on RIGHT');
            }

            // Vertical Check - if it goes off bottom, shift up
            // Note: container.scrollHeight might be large, we care about viewport
            const visibleBottom = container.scrollTop + container.clientHeight;
            if (top + popupHeight > visibleBottom) {
                // Push it up so bottom aligns with visible bottom, but don't go above top
                const diff = (top + popupHeight) - visibleBottom;
                top = Math.max(container.scrollTop + padding, top - diff);
                log.debug('Shifted vertically to fit viewport', { diff, newTop: top });
            }

            setPosition({ top, left });
        }
    }, [isOpen, anchorRef, lesson]);

    // Load files when opened
    useEffect(() => {
        if (!isOpen || !subject || !subjectsLoaded) return;

        setLoading(true);
        log.debug(`Fetching files for subject: ${subject.fullName} url: ${subject.folderUrl}`);

        (async () => {
            try {
                const freshFiles = await getFilesFromId(GetIdFromLink(subject.folderUrl));
                if (freshFiles) {
                    log.debug(`Fetched ${freshFiles.length} files`);
                } else {
                    log.debug('Fetched null files');
                }
                setFiles(freshFiles);
            } catch (e) {
                log.error('Error fetching files', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [isOpen, subject, subjectsLoaded]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setSelectedIds([]);
            setActiveTab('all');
        }
    }, [isOpen]);

    // Click outside handler logic is managed by wrapper but good to have safety
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    // Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Map subfolders to clean names
    const folderMap = useMemo(() => {
        if (!files || files.length === 0) return new Map();
        const map = new Map<string, string>();
        files.forEach(f => {
            if (f.subfolder && f.subfolder.trim()) {
                const displayName = cleanFolderName(f.subfolder, lesson?.courseCode);
                map.set(f.subfolder, displayName);
            }
        });
        log.debug('Folder Mapping', Object.fromEntries(map));
        return map;
    }, [files, lesson?.courseCode]);

    // Get unique tabs
    const tabs = useMemo(() => {
        return Array.from(folderMap.keys()).sort();
    }, [folderMap]);

    // Filter files by active tab
    const visibleFiles = useMemo(() => {
        if (!files) return [];
        let filtered = files;
        if (activeTab !== 'all') {
            filtered = files.filter(f => f.subfolder === activeTab);
        }
        log.debug(`Filter active: ${activeTab}, showing ${filtered.length} files`);
        return filtered;
    }, [files, activeTab]);

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Open file
    const openFile = async (link: string) => {
        log.debug(`Opening file: ${link}`);
        setLoadingFile(true);
        try {
            const fullUrl = await resolveFinalFileUrl(link);
            const response = await fetch(fullUrl, { credentials: 'include' });

            if (!response.ok) {
                window.open(fullUrl, '_blank');
                setLoadingFile(false);
                return;
            }

            const contentType = response.headers.get('content-type');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Get filename
            const cd = response.headers.get('content-disposition');
            let filename = 'document';
            if (cd) {
                const match = cd.match(/filename="?([^"]+)"?/);
                if (match?.[1]) filename = match[1];
            }

            if (contentType?.includes('application/pdf')) {
                const html = `<!DOCTYPE html><html><head><title>${filename}</title><style>body{margin:0;overflow:hidden}</style></head>
<body><embed src="${blobUrl}" type="application/pdf" width="100%" height="100%"></body></html>`;
                const wrapperBlob = new Blob([html], { type: 'text/html' });
                window.open(URL.createObjectURL(wrapperBlob), '_blank');
            } else {
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                a.click();
            }

            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        } catch (e) {
            log.error('Failed to open file', e);
        }
        setLoadingFile(false);
    };

    // Download ZIP
    const downloadZip = async () => {
        if (selectedIds.length < 2 || !lesson) return;
        setIsDownloading(true);
        log.debug(`Downloading ZIP with ${selectedIds.length} files`);

        const zip = new JSZip();

        for (const fileId of selectedIds) {
            try {
                const fullUrl = await resolveFinalFileUrl(fileId);
                const response = await fetch(fullUrl, { credentials: 'include' });
                if (!response.ok) continue;

                const blob = await response.blob();
                const cd = response.headers.get('content-disposition');
                let filename = 'file';
                if (cd) {
                    const match = cd.match(/filename="?([^"]+)"?/);
                    if (match?.[1]) filename = match[1];
                }
                zip.file(filename, blob);
            } catch (e) {
                log.error(`Failed to add file ${fileId} to zip`, e);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `${lesson.courseCode}_files.zip`);
        setIsDownloading(false);
        setSelectedIds([]);
    };

    if (!isOpen || !lesson) return null;

    return (
        <div
            className="fixed inset-0 z-[100]"
            onClick={handleBackdropClick}
        >
            <div
                ref={popupRef}
                className="absolute bg-white rounded-lg shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 w-[350px] max-h-[450px] flex flex-col"
                style={{ top: position.top, left: position.left }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 rounded-t-lg">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{lesson.courseCode}</span>
                            <span className="text-xs bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded shadow-sm">{lesson.room}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{lesson.teachers[0]?.shortName}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs - Scrollable horizontal list for tabs */}
                {tabs.length > 0 && (
                    <div className="flex border-b border-slate-100 px-2 overflow-x-auto no-scrollbar gap-1 pt-1">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'all'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Vše
                        </button>
                        {tabs.map(tabKey => (
                            <button
                                key={tabKey}
                                onClick={() => setActiveTab(tabKey)}
                                className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tabKey
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {folderMap.get(tabKey)}
                            </button>
                        ))}
                    </div>
                )}

                {/* File List */}
                <div className="flex-1 overflow-y-auto p-2 min-h-[150px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-24">
                            <Loader2 size={20} className="animate-spin text-slate-400" />
                        </div>
                    ) : loadingFile ? (
                        <div className="flex items-center justify-center h-24 gap-2">
                            <Loader2 size={20} className="animate-spin text-blue-500" />
                            <span className="text-xs text-slate-500">Otevírání...</span>
                        </div>
                    ) : !files || visibleFiles.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-xs text-slate-400 italic">
                            Žádné soubory v této složce
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {visibleFiles.map((file, i) =>
                                file.files.map((subFile, j) => {
                                    const isSelected = selectedIds.includes(subFile.link);
                                    return (
                                        <div
                                            key={`${i}-${j}`}
                                            className={`group flex items-center gap-2 p-2 rounded hover:bg-slate-50 transition-colors cursor-default ${isSelected ? 'bg-blue-50/60' : ''
                                                }`}
                                        >
                                            {/* DaisyUI Checkbox */}
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-xs checkbox-primary border-slate-300 rounded-sm"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(subFile.link)}
                                            />

                                            {/* File info + click to open */}
                                            <button
                                                onClick={() => openFile(subFile.link)}
                                                className="flex-1 flex items-center gap-2 text-left min-w-0 group/text"
                                            >
                                                <FileText size={14} className="text-slate-400 flex-shrink-0 transition-colors group-hover/text:text-blue-500" />
                                                <span className="text-xs text-slate-700 font-medium group-hover/text:text-blue-600 group-hover/text:underline truncate">
                                                    {file.files.length === 1
                                                        ? file.file_name
                                                        : `${file.file_name}: část ${j + 1}`
                                                    }
                                                </span>
                                                <ExternalLink size={10} className="text-slate-300 opacity-0 group-hover/text:opacity-100 flex-shrink-0 transition-opacity" />
                                            </button>

                                            {/* Comment badge */}
                                            {file.file_comment && (
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                                    {file.file_comment}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Download button - show when >= 2 selected */}
                {selectedIds.length >= 2 && (
                    <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-lg">
                        <button
                            onClick={downloadZip}
                            disabled={isDownloading}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white text-xs font-semibold rounded shadow-sm transition-all"
                        >
                            {isDownloading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Stahování...
                                </>
                            ) : (
                                <>
                                    <Download size={14} />
                                    Stáhnout ({selectedIds.length})
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
