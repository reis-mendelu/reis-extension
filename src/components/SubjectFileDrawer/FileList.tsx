/**
 * File List Component
 *
 * Renders the file grid with selection support. A single row lives in
 * FileListItem; this file owns the grouping around it.
 */

import { useState } from 'react';
import { Folder } from 'lucide-react';
import type { FileListProps } from './types';
import { collapseAttachments } from '../../api/documents/collapseAttachments';
import { useTranslation } from '../../hooks/useTranslation';
import { useDocumentNoteKeys } from '../../hooks/data/useDocumentNoteKeys';
import { changedOn, lastChanged } from './utils/fileDate';
import { ISBacklink } from './ISBacklink';
import { FileListItem } from './FileListItem';
import { DocumentFiles } from './DocumentFiles';
import { attachmentLabel, documentTitle } from '../../utils/documentLabels';
import type { FileAttachment, ParsedFile } from '../../types/documents';

/** Keyed on the last change, not the document date: IS keeps the date when files are replaced. */
function isNewSinceVisit(file: ParsedFile, lastVisitedAt: number | null | undefined): boolean {
  if (typeof lastVisitedAt !== 'number') return false;
  const d = lastChanged(file);
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
  openingLink,
  downloadingLinks,
  folderUrl,
  lastVisitedAt,
  selectable = true,
  showIsBacklink = true,
}: FileListProps) {
  const { t, language } = useTranslation();
  const { noteKeys } = useDocumentNoteKeys(courseCode);
  const [expandedLink, setExpandedLink] = useState<string | null>(null);

  const renderRow = (
    file: ParsedFile,
    subFile: FileAttachment,
    displayName: string,
    { isNew = false, compact = false }: { isNew?: boolean; compact?: boolean }
  ) => (
    <FileListItem
      key={subFile.link}
      subFile={subFile}
      displayName={displayName}
      date={file.date}
      readerDate={changedOn(file)}
      author={file.author}
      comment={file.file_comment}
      isNew={isNew}
      compact={compact}
      isSelected={selectedIds.includes(subFile.link)}
      selectable={selectable}
      hasNote={noteKeys.has(subFile.link)}
      isExpanded={expandedLink === subFile.link}
      courseCode={courseCode}
      fileRefs={fileRefs}
      ignoreClickRef={ignoreClickRef}
      onToggleSelect={onToggleSelect}
      onOpenFile={onOpenFile}
      onViewPdf={onViewPdf}
      isOpening={openingLink === subFile.link}
      downloadTick={downloadingLinks?.[subFile.link] ?? null}
      onDownloadSingle={onDownloadSingle}
      onToggleNote={() => setExpandedLink(expandedLink === subFile.link ? null : subFile.link)}
      onCloseNote={() => setExpandedLink(null)}
    />
  );

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/50 italic">
        {t('course.footer.noFiles')}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {groups.map((group) => (
        <div key={group.name} className="space-y-3">
          {/* The folder the teacher filed these under in IS — "Kombinovaná
              forma studia" is what tells a student "Blok 1" is not for them.
              It was faint uppercase caption text (`/50`, tracking-wider), the
              weakest thing in the drawer, so the files beneath it read as
              belonging to nothing. A real heading now, sentence case (long IS
              folder names read badly in capitals), with a hairline under it
              and the count, so each group reads as a section. */}
          <h3 className="flex items-center gap-2 border-b border-base-content/10 px-2 pb-1.5 text-sm font-bold text-base-content">
            <Folder size={15} className="flex-shrink-0 text-primary" />
            <span className="min-w-0 flex-1">{group.displayName}</span>
            <span className="flex-shrink-0 text-xs font-medium tabular-nums text-base-content/60">
              {group.files.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 gap-1">
            {group.files.map((file, i) => {
              // Defensive: fetchFilesFromFolder already collapses the
              // viewer+download pair IS emits per document, but files can also
              // reach the store from older cached data.
              const attachments = collapseAttachments(file.files);
              const isNew = isNewSinceVisit(file, lastVisitedAt);
              if (attachments.length <= 1) {
                return (
                  <div key={i} className="space-y-1">
                    {attachments.map((subFile) =>
                      renderRow(file, subFile, documentTitle(file), { isNew })
                    )}
                  </div>
                );
              }
              return (
                <DocumentFiles
                  key={i}
                  title={documentTitle(file)}
                  date={file.date}
                  author={file.author}
                  comment={file.file_comment}
                  isNew={isNew}
                >
                  {attachments.map((subFile, j) =>
                    renderRow(
                      file,
                      subFile,
                      attachmentLabel(file, subFile, j, attachments.length),
                      {
                        compact: true,
                      }
                    )
                  )}
                </DocumentFiles>
              );
            })}
          </div>
        </div>
      ))}
      {folderUrl && showIsBacklink && (
        <ISBacklink
          href={
            folderUrl.includes('?')
              ? `${folderUrl};lang=${language === 'cz' ? 'cz' : 'en'}`
              : `${folderUrl}?lang=${language === 'cz' ? 'cz' : 'en'}`
          }
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
            <div className="skeleton w-4 h-4 rounded-full bg-base-300"></div>
            <div className="skeleton h-4 w-32 rounded bg-base-300"></div>
          </div>
          {/* Files Grid Skeleton */}
          <div className="grid grid-cols-1 gap-1">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="flex items-center gap-3 p-3 rounded-lg border border-transparent bg-base-100"
              >
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
