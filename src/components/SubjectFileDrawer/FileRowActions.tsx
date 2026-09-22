/**
 * The control cluster at the right end of a file row: the open-in-reader
 * spinner, the note toggle, the download button (which is also where this
 * row's download progress appears), the open-in-reader button and the type
 * badge.
 *
 * Split out of FileListItem when adding download progress pushed that file
 * past the 200-line convention. The cluster is the natural seam: everything
 * here is an affordance on the row, and nothing here owns the row's layout.
 */

import { Download, PanelRightOpen, StickyNote } from 'lucide-react';
import type { FileAttachment } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import { NOTES_ENABLED } from '../../config/featureFlags';
import { FileTypeBadge } from './fileRowBits';
import { DownloadProgress } from '../ui/DownloadProgress';
import type { DownloadTick } from '../../hooks/ui/readBlobWithProgress';
import { isPdfFile } from './utils/isPdfFile';
import type { PdfRowMeta } from './types';

export interface FileRowActionsProps {
  subFile: FileAttachment;
  displayName: string;
  date: string;
  hasNote: boolean;
  isExpanded: boolean;
  /** This row's file is being fetched for the reader right now. */
  isOpening: boolean;
  /** Bytes so far for this row's download, or null when it is not downloading. */
  downloadTick: DownloadTick | null;
  onToggleNote: () => void;
  onViewPdf?: (link: string, meta: PdfRowMeta) => void;
  onDownloadSingle?: (link: string) => void;
}

export function FileRowActions({
  subFile,
  displayName,
  date,
  hasNote,
  isExpanded,
  isOpening,
  downloadTick,
  onToggleNote,
  onViewPdf,
  onDownloadSingle,
}: FileRowActionsProps) {
  const { t } = useTranslation();
  const isDownloading = downloadTick != null;
  const downloadLabel = isDownloading
    ? t('course.footer.downloading')
    : t('course.footer.download') || 'Download';

  return (
    <div className="flex items-center gap-1">
      {/* The whole point of this row's existence per the report: "there's no
          loading so it seems the button is not working". It sits with the
          row's other controls so nothing reflows when it appears. */}
      {isOpening && (
        <span
          data-testid="file-row-spinner"
          // The tonal token for the same measured reason as DownloadProgress:
          // raw `text-primary` is 2.29:1 on the light theme's white row.
          className="loading loading-spinner loading-xs text-[var(--btn-tonal-primary)]"
        />
      )}
      {NOTES_ENABLED && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleNote();
          }}
          className={`btn btn-ghost btn-xs btn-square ${hasNote || isExpanded ? 'text-primary hover:text-primary' : 'text-base-content/40 hover:text-base-content/70'}`}
          title={hasNote ? t('course.documentNote.edit') : t('course.documentNote.add')}
        >
          <StickyNote size={14} className={hasNote ? 'fill-primary/15' : ''} />
        </button>
      )}
      {onDownloadSingle && (
        <button
          // The indicator replaces the icon INSIDE the button rather than
          // sitting beside it: the row is already several controls wide at
          // 320px, and an extra element would push the type badge off.
          // Disabled while it runs so the affordance stops claiming to start
          // something the hook would refuse anyway.
          disabled={isDownloading}
          aria-busy={isDownloading || undefined}
          data-testid={`file-download-${subFile.link}`}
          onClick={(e) => {
            e.stopPropagation();
            onDownloadSingle(subFile.link);
          }}
          className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content/70"
          title={downloadLabel}
        >
          {isDownloading ? (
            <DownloadProgress tick={downloadTick} label={downloadLabel} />
          ) : (
            <Download size={14} />
          )}
        </button>
      )}
      {isPdfFile(subFile) && onViewPdf && (
        <button
          // Both `onViewPdf` implementations already refuse a second call
          // while the first is in flight, so this is about the affordance,
          // not the fetch: the row is showing a spinner and this button
          // should not still look like it is offering to do something.
          disabled={isOpening}
          onClick={(e) => {
            e.stopPropagation();
            onViewPdf(subFile.link, { name: displayName, date });
          }}
          className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-primary"
          title={t('course.footer.openInSidebar') || 'Open in Sidebar'}
        >
          <PanelRightOpen size={14} />
        </button>
      )}
      <FileTypeBadge type={subFile.type} />
    </div>
  );
}
