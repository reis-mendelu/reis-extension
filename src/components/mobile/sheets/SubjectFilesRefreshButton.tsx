import { RefreshButton } from '../primitives/RefreshButton';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSubjectFilesRefresh } from './useSubjectFilesRefresh';

/**
 * The Files tab's refresh for whoever cannot pull: a visible circle beside the
 * rename pencil on a Mac, `sr-only` on a touch screen (see RefreshButton).
 *
 * Before it, the pull was the only way to look for a file the teacher had just
 * uploaded, and the iPad app on a Mac gets no pull at all — a Mac student could
 * only close the sheet and wait for the files to go stale. Same action as the
 * pull and as the extension's FilesFreshness circle, and "Obnovit soubory" is
 * that circle's own label.
 *
 * Disabled for any load, list or not: a second press while one runs would only
 * start the same crawl again.
 */
export function SubjectFilesRefreshButton({ courseCode }: { courseCode: string }) {
  const { t } = useTranslation();
  const { loading, refresh } = useSubjectFilesRefresh(courseCode);
  return (
    <RefreshButton label={t('course.freshness.refresh')} refreshing={loading} onRefresh={refresh} />
  );
}
