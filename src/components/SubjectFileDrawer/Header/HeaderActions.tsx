import { X, Download, Loader2 } from 'lucide-react';

interface HeaderActionsProps {
    selectedCount: number;
    isDownloading: boolean;
    downloadProgress: { completed: number; total: number } | null;
    onDownload: () => void;
    onClose: () => void;
}

export function HeaderActions({ selectedCount, isDownloading, downloadProgress, onDownload, onClose }: HeaderActionsProps) {
    const downloadLabel = downloadProgress 
        ? `Stahování (${downloadProgress.completed}/${downloadProgress.total})...` 
        : (isDownloading ? 'Stahování...' : `Stáhnout (${selectedCount})`);

    return (
        <div className="flex items-center gap-2">
            {selectedCount > 0 && (
                <button onClick={onDownload} disabled={isDownloading}
                        className="btn btn-sm btn-primary gap-2 interactive bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white disabled:opacity-75">
                    {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {downloadLabel}
                </button>
            )}
            <button onClick={onClose} disabled={isDownloading} className="btn btn-ghost btn-circle btn-sm interactive disabled:opacity-30">
                <X size={20} className="text-base-content/40" />
            </button>
        </div>
    );
}
