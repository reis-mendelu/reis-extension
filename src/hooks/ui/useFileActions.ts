/**
 * useFileActions - Hook for file operations (open, download ZIP).
 */

import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { normalizeFileUrl } from '../../utils/fileUrl';
import { createLogger } from '../../utils/logger';
import { requestQueue } from '../../utils/requestQueue';

const log = createLogger('useFileActions');

interface DownloadProgress {
    completed: number;
    total: number;
}

interface UseFileActionsResult {
    isDownloading: boolean;
    downloadProgress: DownloadProgress | null;
    openFile: (link: string) => Promise<void>;
    openPdfInline: (link: string) => Promise<string | null>;
    downloadSingle: (link: string) => Promise<void>;
    downloadZip: (fileLinks: string[], zipFileName: string) => Promise<void>;
}

export function useFileActions(): UseFileActionsResult {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

    const openFile = useCallback(async (link: string) => {
        const fullUrl = normalizeFileUrl(link);

        try {
            const response = await fetch(fullUrl, { credentials: 'include' });

            if (!response.ok) {
                log.warn('Fetch failed, falling back to direct link');
                window.open(fullUrl, '_blank');
                return;
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            window.open(blobUrl, '_blank');

            // Clean up after 5 minutes
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
        } catch (e) {
            log.error('Failed to fetch file as blob, falling back to direct link', e);
            window.open(fullUrl, '_blank');
        }
    }, []);

    const openPdfInline = useCallback(async (link: string): Promise<string | null> => {
        const fullUrl = normalizeFileUrl(link);
        try {
            const response = await fetch(fullUrl, { credentials: 'include' });
            console.log('[openPdfInline] url:', fullUrl, 'status:', response.status, 'ok:', response.ok, 'content-type:', response.headers.get('content-type'));
            if (!response.ok) return null;
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (e) {
            log.error('Failed to fetch PDF inline', e);
            return null;
        }
    }, []);

    const downloadSingle = useCallback(async (link: string) => {
        const fullUrl = normalizeFileUrl(link);
        try {
            const response = await fetch(fullUrl, { credentials: 'include' });
            if (!response.ok) { window.open(fullUrl, '_blank'); return; }
            const blob = await response.blob();
            const cd = response.headers.get('content-disposition');
            const match = cd?.match(/filename="?([^"]+)"?/);
            const filename = match?.[1] || link.split('/').pop() || 'download';
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (e) {
            log.error('Failed to download file', e);
            window.open(fullUrl, '_blank');
        }
    }, []);

    const downloadZip = useCallback(async (fileLinks: string[], zipFileName: string) => {
        if (fileLinks.length < 2) return;

        setIsDownloading(true);
        setDownloadProgress({ completed: 0, total: fileLinks.length });

        const zip = new JSZip();

        try {
            const downloadPromises = fileLinks.map(async (link) => {
                return requestQueue.add(async () => {
                    try {
                        const fullUrl = normalizeFileUrl(link);

                        // Basic retry logic (1 retry)
                        let response = await fetch(fullUrl, { credentials: 'include' });
                        if (!response.ok && response.status >= 500) {
                            response = await fetch(fullUrl, { credentials: 'include' });
                        }

                        if (!response.ok) {
                            setDownloadProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null);
                            return;
                        }

                        const blob = await response.blob();
                        
                        const cd = response.headers.get('content-disposition');
                        let filename = 'file';
                        if (cd) {
                            const match = cd.match(/filename="?([^"]+)"?/);
                            if (match?.[1]) filename = match[1];
                        }
                        
                        if (filename === 'file') {
                            filename = link.split('/').pop() || `file_${Math.random().toString(36).substr(2, 9)}`;
                        }

                        filename = filename.replace(/[\\/:*?"<>|]/g, '_');
                        zip.file(filename, blob);
                        
                        // Update progress after successful download and processing
                        setDownloadProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null);
                    } catch (e) {
                        log.error(`Failed to add file ${link} to zip`, e);
                        setDownloadProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null);
                    }
                });
            });

            await Promise.all(downloadPromises);

            const entries = Object.keys(zip.files);
            if (entries.length === 0) return;

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, zipFileName);
        } catch (e) {
            log.error('Failed to generate/save ZIP', e);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
        }
    }, []);

    return { isDownloading, downloadProgress, openFile, openPdfInline, downloadSingle, downloadZip };
}
