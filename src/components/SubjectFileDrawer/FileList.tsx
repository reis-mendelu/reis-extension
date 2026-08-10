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
import { parseIsDate } from './utils/fileDate';
import { ISBacklink } from './ISBacklink';
import { FileListItem } from './FileListItem';

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
  lastVisitedAt,
  selectable = true,
  showIsBacklink = true,
}: FileListProps) {
  const { t, language } = useTranslation();
  const { noteKeys } = useDocumentNoteKeys(courseCode);
  const [expandedLink, setExpandedLink] = useState<string | null>(null);

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
          <div className="flex items-center gap-2 px-2 text-sm font-semibold text-base-content/50 uppercase tracking-wider">
            <Folder size={14} />
            {group.displayName}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {group.files.map((file, i) => {
              // Defensive: fetchFilesFromFolder already collapses the
              // viewer+download pair IS emits per document, but files can also
              // reach the store from older cached data.
              const attachments = collapseAttachments(file.files);
              return (
                <div key={i} className="space-y-1">
                  {attachments.map((subFile, j) => (
                    <FileListItem
                      key={subFile.link}
                      subFile={subFile}
                      displayName={
                        attachments.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name
                      }
                      date={file.date}
                      comment={file.file_comment}
                      isNew={isNewSinceVisit(file.date, lastVisitedAt)}
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
                      onDownloadSingle={onDownloadSingle}
                      onToggleNote={() =>
                        setExpandedLink(expandedLink === subFile.link ? null : subFile.link)
                      }
                      onCloseNote={() => setExpandedLink(null)}
                    />
                  ))}
                </div>
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
