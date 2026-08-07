import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { ErasmusPanel } from '../../ErasmusPanel';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

export interface ErasmusSheetProps {
  onClose: () => void;
}

/**
 * Hosts the existing desktop `ErasmusPanel` full-screen inside the phone's
 * `full` sheet. Deliberately NOT a phone-native redesign: the Learning
 * Agreement tables and Europe map stay cramped on a phone — that is an
 * accepted v1 limitation with its own follow-up spec. `ErasmusPanel` has no
 * header of its own (unlike `StudyPlanPage`), so this sheet adds one.
 * `onSearchSubject` has no mobile equivalent (it prefills the desktop
 * sidebar's search bar) so it's a no-op here.
 */
export function ErasmusSheet({ onClose }: ErasmusSheetProps) {
  const { t } = useTranslation();
  const pushSheet = useAppStore((s) => s.pushSheet);

  const openSubject = (courseCode: string, courseName?: string, courseId?: string) => {
    pushSheet({ kind: 'subjectDrawer', courseCode, courseName, courseId });
  };

  return (
    <Sheet size="full" onClose={onClose}>
      <SheetHeader title={t('mobile.student.erasmus')} onClose={onClose} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ErasmusPanel
          onOpenSubject={openSubject}
          onSearchSubject={() => {}}
          showLearningAgreement={false}
        />
      </div>
    </Sheet>
  );
}
