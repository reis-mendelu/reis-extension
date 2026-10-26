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
 * `refreshing`, not every load: over the skeleton the tab's own "Načítání
 * souborů…" already says it, and a spinning circle said it a third time. A
 * press then is harmless — the refresh ignores a second start while one runs.
 */
export function SubjectFilesRefreshButton({ courseCode }: { courseCode: string }) {
  const { t } = useTranslation();
  const { refreshing, refresh } = useSubjectFilesRefresh(courseCode);
  return (
    <RefreshButton
      label={t('course.freshness.refresh')}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}
