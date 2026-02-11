import { WelcomeModal } from './Onboarding/WelcomeModal'
import { SubjectFileDrawer } from './SubjectFileDrawer'
import { OutlookSyncHint } from './OutlookSyncHint'
import { FeedbackModal } from './Feedback/FeedbackModal'
import { TutorialModal } from './Tutorials'
import type { BlockLesson } from '../types/calendarTypes';

interface AppOverlaysProps {
    selectedSubject: (BlockLesson & { isExam?: boolean }) | null;
    setSelectedSubject: (subject: (BlockLesson & { isExam?: boolean }) | null) => void;
    weekNavCount: number;
    outlookSyncEnabled: boolean;
    openSettingsRef: React.RefObject<() => void>;
    isFeedbackOpen: boolean;
    setIsFeedbackOpen: (open: boolean) => void;
    selectedTutorial: string | null;
    setSelectedTutorial: (tutorial: string | null) => void;
}

export function AppOverlays({ 
    selectedSubject, setSelectedSubject, weekNavCount, outlookSyncEnabled, 
    openSettingsRef, isFeedbackOpen, setIsFeedbackOpen, selectedTutorial, setSelectedTutorial 
}: AppOverlaysProps) {
    return (
        <>
            <SubjectFileDrawer lesson={selectedSubject} isOpen={!!selectedSubject} onClose={() => setSelectedSubject(null)} />
            <OutlookSyncHint navigationCount={weekNavCount} isSyncEnabled={outlookSyncEnabled} onSetup={() => openSettingsRef.current?.()} />
            <WelcomeModal />
            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
            {selectedTutorial && <TutorialModal tutorial={selectedTutorial} isOpen={!!selectedTutorial} onClose={() => setSelectedTutorial(null)} />}
        </>
    );
}
