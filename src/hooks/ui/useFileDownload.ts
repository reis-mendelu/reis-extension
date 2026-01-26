import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { resolveFinalFileUrl } from './useFileDownload/urlResolver';

export interface FileInfo { url: string; name: string; subfolder?: string; }
export interface UseFileDownloadOptions { onRefreshUrls?: () => Promise<FileInfo[] | null>; onDownloadStart?: () => void; onDownloadComplete?: () => void; onError?: (error: Error) => void; }

export function useFileDownload(options: UseFileDownloadOptions = {}) {
    const { onRefreshUrls, onDownloadStart, onDownloadComplete, onError } = options;
    const [isDownloading, setIsDownloading] = useState(false);
    const [isLoadingFile, setIsLoadingFile] = useState(false);

    const downloadFile = useCallback(async (url: string, retryCount = 0) => {
        setIsLoadingFile(true); onDownloadStart?.();
        try {
            const full = await resolveFinalFileUrl(url);
            const res = await fetch(full, { credentials: 'include', headers: { 'Accept': 'application/pdf,application/octet-stream,*/*' } });
            if (res.status === 404 && retryCount === 0 && onRefreshUrls) {
                const fresh = await onRefreshUrls();
                const clean = url.split('/').pop()?.split('?')[0];
                const ref = fresh?.find(f => f.url.includes(clean || '') || f.name === clean);
                if (ref) return await downloadFile(ref.url, 1);
            }
            if (!res.ok || res.headers.get('content-type')?.includes('text/html')) { window.open(full, '_blank'); return; }
            const blob = await res.blob(), bUrl = URL.createObjectURL(blob);
            if (res.headers.get('content-type')?.includes('application/pdf')) window.open(bUrl, '_blank');
            else {
                const a = document.createElement('a'); a.href = bUrl;
                const cd = res.headers.get('content-disposition'), m = cd?.match(/filename="?([^"]+)"?/);
                a.download = m?.[1] || 'download'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }
            setTimeout(() => URL.revokeObjectURL(bUrl), 1000); onDownloadComplete?.();
        } catch (e) { onError?.(e as Error); } finally { setIsLoadingFile(false); }
    }, [onRefreshUrls, onDownloadStart, onDownloadComplete, onError]);

    const downloadAsZip = useCallback(async (files: FileInfo[], zipName: string) => {
        if (!files.length) return;
        setIsDownloading(true); onDownloadStart?.();
        const zip = new JSZip();
        try {
            await Promise.all(files.map(async (f) => {
                try {
                    const r = await fetch(await resolveFinalFileUrl(f.url), { credentials: 'include' });
                    if (!r.ok) return;
                    const cd = r.headers.get('content-disposition'), m = cd?.match(/filename="?([^"]+)"?/);
                    let name = m?.[1] || f.name;
                    if (f.subfolder) name = `${f.subfolder.replace(/^\/|\/$/g, '').replace(/\//g, '_')}_${name}`;
                    zip.file(name, await r.blob());
                } catch (e) { console.warn(e); }
            }));
            saveAs(await zip.generateAsync({ type: 'blob' }), `${zipName}.zip`);
            onDownloadComplete?.();
        } catch (e) { onError?.(e as Error); } finally { setIsDownloading(false); }
    }, [onDownloadStart, onDownloadComplete, onError]);

    return { isDownloading, isLoadingFile, downloadFile, downloadAsZip };
}
