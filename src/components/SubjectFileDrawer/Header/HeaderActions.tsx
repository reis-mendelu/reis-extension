import { X, Download, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface HeaderActionsProps {
  selectedCount: number;
  isDownloading: boolean;
  downloadProgress?: { completed: number; total: number } | null;
  onDownload: () => void;
  onClose: () => void;
}

export function HeaderActions({
  selectedCount,
  isDownloading,
  downloadProgress,
  onDownload,
  onClose,
}: HeaderActionsProps) {
  const { t } = useTranslation();

  // All three labels were hardcoded Czech in a dual-language app, so an English
  // student watched a bar count up under a Czech word. The counter's unit is
  // FILES: a zip fans out N parallel requests whose sizes nobody knows until
  // each response lands, so completed/total is the only honest denominator.
  const downloadLabel = downloadProgress
    ? t('course.footer.downloadingCount', {
        completed: downloadProgress.completed,
        total: downloadProgress.total,
      })
    : isDownloading
      ? t('course.footer.downloading')
      : t('course.footer.downloadSelected', { count: selectedCount });

  return (
    <div className="flex items-center gap-2">
      {selectedCount > 0 && (
        <button
          onClick={onDownload}
          disabled={isDownloading}
          aria-busy={isDownloading || undefined}
          className="btn btn-sm btn-primary gap-2 interactive bg-success hover:bg-success/90 border-success text-success-content disabled:opacity-75"
        >
          {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {downloadLabel}
        </button>
      )}
      <button
        onClick={onClose}
        disabled={isDownloading}
        className="btn btn-ghost btn-circle btn-sm interactive disabled:opacity-30"
      >
        <X size={20} className="text-base-content/40" />
      </button>
    </div>
  );
}
