import { Sheet } from '../primitives/Sheet';
import { StudyPlanPage } from '../../SubjectsPanel/StudyPlanPage';
import { useAppStore } from '../../../store/useAppStore';

export interface StudyPlanSheetProps {
  onClose: () => void;
}

/**
 * Hosts the existing desktop `StudyPlanPage` as a pushed SCREEN.
 *
 * It was a `full` bottom sheet: it slid up over the tab under a drag pill,
 * dimmed the screen behind it, and could be thrown away downward. Wrong
 * vocabulary — "studijni plan shouldn't be a slidedown but rather it's own page
 * when I click on it". A bottom sheet says "temporary, and what is underneath
 * still matters", which is right for a subject's detail and wrong for a whole
 * curriculum you navigate into and then walk back out of.
 *
 * `variant="screen"` is the shape the app already had for this, and
 * `SubjectDrawerSheet` — pushed FROM this page — has used it all along, so
 * going one level deeper used to mean going sheet → page → sheet.
 *
 * Still in the sheet STACK, which is what keeps back working and lets it push
 * the subject drawer on top; only the presentation changed. `StudyPlanPage`
 * renders its own header (back arrow + title), so this adds no chrome — and no
 * drag pill, which would advertise a gesture a screen deliberately lacks.
 */
export function StudyPlanSheet({ onClose }: StudyPlanSheetProps) {
  const pushSheet = useAppStore((s) => s.pushSheet);

  const openSubject = (courseCode: string, courseName: string, courseId: string) => {
    pushSheet({ kind: 'subjectDrawer', courseCode, courseName, courseId });
  };

  // The page's own SearchBar is hidden here, so "look this subject up" has to
  // go somewhere: the header's search sheet, prefilled and in subject mode.
  // Without this the fail-rate badge on a subject with no id would be a dead
  // tap — the page still renders those controls.
  const searchSubject = (name: string) => pushSheet({ kind: 'search', query: name });

  return (
    <Sheet size="full" variant="screen" onClose={onClose}>
      <div className="flex flex-1 flex-col overflow-hidden">
        <StudyPlanPage
          onBack={onClose}
          onOpenSubject={openSubject}
          showSearch={false}
          onSearchSubject={searchSubject}
        />
      </div>
    </Sheet>
  );
}
