import { Sheet } from '../primitives/Sheet';
import { StudyPlanPage } from '../../SubjectsPanel/StudyPlanPage';
import { useAppStore } from '../../../store/useAppStore';

export interface StudyPlanSheetProps {
    onClose: () => void;
}

/**
 * Hosts the existing desktop `StudyPlanPage` full-screen inside the phone's
 * `full` sheet. `StudyPlanPage` already renders its own header (back arrow +
 * title + subject search) so this sheet adds only the shared drag handle —
 * a second title row would just duplicate it. The back arrow closes the
 * sheet directly; opening a subject pushes the same `subjectDrawer` sheet
 * `SubjectsScreen` already uses.
 */
export function StudyPlanSheet({ onClose }: StudyPlanSheetProps) {
    const pushSheet = useAppStore((s) => s.pushSheet);

    const openSubject = (courseCode: string, courseName: string, courseId: string) => {
        pushSheet({ kind: 'subjectDrawer', courseCode, courseName, courseId });
    };

    return (
        <Sheet size="full" onClose={onClose}>
            <div className="mx-auto mt-2 mb-1 h-1 w-9 flex-shrink-0 rounded-full bg-base-300" />
            <div className="flex flex-1 flex-col overflow-hidden">
                <StudyPlanPage onBack={onClose} onOpenSubject={openSubject} />
            </div>
        </Sheet>
    );
}
