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
import { attachmentLabel, documentTitle, prettifyTitle } from '../../utils/documentLabels';
import { rowExtension, shownNames } from './utils/shownNames';
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
    {
      isNew = false,
      compact = false,
      shown,
    }: { isNew?: boolean; compact?: boolean; shown?: string }
  ) => (
    <FileListItem
      key={subFile.link}
      subFile={subFile}
      displayName={displayName}
      shownName={shown}
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
      {groups.map((group) => {
        // Single-file documents of this folder, compared for same-name rows.
        const titleShown = shownNames(
          group.files.map((file) => {
            const only = collapseAttachments(file.files);
            if (only.length !== 1 || !only[0]) return null;
            return { name: documentTitle(file), kind: 'title', ext: rowExtension(only[0]) };
          })
        );
        return (
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
                        renderRow(file, subFile, documentTitle(file), {
                          isNew,
                          shown: titleShown[i],
                        })
                      )}
                    </div>
                  );
                }
                const fileShown = shownNames(
                  attachments.map((a, j) => ({
                    name: attachmentLabel(file, a, j, attachments.length),
                    kind: 'file',
                    ext: rowExtension(a),
                  }))
                );
                return (
                  <DocumentFiles
                    key={i}
                    title={prettifyTitle(documentTitle(file))}
                    fullTitle={documentTitle(file)}
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
                        { compact: true, shown: fileShown[j] }
                      )
                    )}
                  </DocumentFiles>
                );
              })}
            </div>
          </div>
        );
      })}
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
