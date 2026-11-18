import { BookOpen } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useStudyAids } from '../../../../hooks/useStudyAids';
import { trackFeatureSignal } from '../../../../api/featureUsage';
import { openExternal } from '../../../../mobile/openExternal';
import { logError } from '../../../../utils/reportError';
import { NavRow } from '../../primitives/NavRow';

/**
 * "Studijní opory" under the semester card: the study aids on mendelu.app, one
 * tap to the site. A NavRow that leaves the app, in a card of its own, with the
 * sublabel saying what is behind it.
 *
 * Shown only to the students whose faculty and programme the admin console has
 * picked (the `study_aids` row, decided on the device by `useStudyAids`). It
 * renders nothing otherwise, so no empty slot.
 *
 * `openExternal` rather than a `target="_blank"` link, like the page directory:
 * a third-party host goes to the real browser view, never the IS WebView. The
 * tap is counted on the install (`study_aids_click_mendelu_app`), because the
 * site's author is told how many installs followed the link. The extension's
 * half is SubjectsPanel/StudyAidsLink.
 */
export function StudyAidsRow() {
  const { t } = useTranslation();
  const aids = useStudyAids();
  if (!aids) return null;

  const open = () => {
    void trackFeatureSignal(aids.clickSignal);
    // Caught rather than voided: in demo mode it rejects with DemoModeError, and
    // logError is what turns that into the demo toast.
    openExternal(aids.url).catch((e: unknown) => logError('SubjectsScreen.openStudyAids', e));
  };

  return (
    <div
      data-testid="study-aids-row"
      className="flex-shrink-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-card"
    >
      <NavRow
        icon={BookOpen}
        label={t('subjects.studyAids')}
        sublabel={t('subjects.studyAidsHint')}
        external
        onClick={open}
      />
    </div>
  );
}
