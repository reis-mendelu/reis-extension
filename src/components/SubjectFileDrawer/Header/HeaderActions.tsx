import { X, Download, Loader2 } from 'lucide-react';

export function HeaderActions({ selectedCount, isDownloading, onDownload, onClose }: any) {
    return (
        <div className="flex items-center gap-2">
            {selectedCount > 0 && (
                <button onClick={onDownload} disabled={isDownloading}
                        className="btn btn-sm btn-primary gap-2 interactive bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white disabled:opacity-75">
                    {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {isDownloading ? 'Stahování...' : `Stáhnout (${selectedCount})`}
                </button>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm interactive"><X size={20} className="text-base-content/40" /></button>
        </div>
    );
}
