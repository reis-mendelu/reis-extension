import type { ReactNode } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FileRowMeta } from './fileRowBits';

interface DocumentFilesProps {
  title: string;
  date: string;
  author?: string;
  comment?: string;
  isNew: boolean;
  /** One FileListItem per file, each named by its own file name. */
  children: ReactNode;
}

/**
 * One IS document that holds several files: its title once, as a small
 * heading, and its files beneath it.
 *
 * Before this the drawer repeated the title on every file with "(1)"…"(5)"
 * after it, and on a phone the truncation cut the number off, so a lecture
 * with five PDFs read as five identical rows. The heading carries what the
 * files share (date, author, comment, "Nový"); the rows carry only their names.
 */
export function DocumentFiles({
  title,
  date,
  author,
  comment,
  isNew,
  children,
}: DocumentFilesProps) {
  const { t } = useTranslation();
  return (
    <div data-testid="document-files" className="space-y-1 pt-1">
      <div className="px-3">
        {/* h4: one level under the folder's h3, so assistive tech hears the
            files as this document's. */}
        <h4 className="flex items-start gap-2 text-sm font-semibold text-base-content">
          <span className="line-clamp-2 min-w-0">{title}</span>
          {isNew && (
            <span className="badge badge-primary badge-xs mt-0.5 shrink-0 font-bold">
              {t('course.freshness.newBadge')}
            </span>
          )}
        </h4>
        <div className="flex items-center gap-2 truncate text-xs text-base-content/70">
          <FileRowMeta date={date} author={author} comment={comment} />
        </div>
      </div>
      <div className="ml-3 space-y-1 border-l border-base-content/10 pl-1">{children}</div>
    </div>
  );
}
