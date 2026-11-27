import { useTranslation } from '../../../../hooks/useTranslation';
import { useStudyAids } from '../../../../hooks/useStudyAids';
import { trackFeatureSignal } from '../../../../api/featureUsage';
import { openExternal } from '../../../../mobile/openExternal';
import { logError } from '../../../../utils/reportError';
import { NavRow } from '../../primitives/NavRow';
import { studyAidsIcon } from '../../../StudyAids/studyAidsIcon';
import type { StudyAidsEntry } from '../../../../data/studyAids';

/**
 * The links under the semester card for this student's field (mendelu.app's
 * "Studijní opory", their programme's Discord): one tap to the site each. A
 * NavRow that leaves the app, in a card of its own per link, with the sublabel
 * saying what is behind it.
 *
 * Shown only to the students whose faculty and programme the admin console has
 * picked (each link's `study_aids` row, decided on the device by
 * `useStudyAids`). It renders nothing otherwise, so no empty slot.
 *
 * `openExternal` rather than a `target="_blank"` link, like the page directory:
 * a third-party host goes to the real browser view, never the IS WebView, and a
 * Discord invite goes to the Discord app (`HAS_OWN_APP`). A tap is counted on
 * the install under the link's own label. The extension's half is
 * SubjectsPanel/StudyAidsLink.
 */
export function StudyAidsRow() {
  const { t } = useTranslation();
  const aids = useStudyAids();
  if (aids.length === 0) return null;

  const open = (aid: StudyAidsEntry) => {
    void trackFeatureSignal(aid.clickSignal);
    // Caught rather than voided: in demo mode it rejects with DemoModeError, and
    // logError is what turns that into the demo toast.
    openExternal(aid.url).catch((e: unknown) => logError('SubjectsScreen.openStudyAids', e));
  };

  return (
    <>
      {aids.map((aid) => (
        <div
          key={aid.id}
          data-testid="study-aids-row"
          className="flex-shrink-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-card"
        >
          <NavRow
            icon={studyAidsIcon(aid.icon)}
            label={t(aid.labelKey)}
            sublabel={t(aid.hintKey)}
            external
            onClick={() => open(aid)}
          />
        </div>
      ))}
    </>
  );
}
