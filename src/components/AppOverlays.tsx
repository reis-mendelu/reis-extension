import { WelcomeModal } from './Onboarding/WelcomeModal'
import { SubjectFileDrawer } from './SubjectFileDrawer'
import { FeedbackModal } from './Feedback/FeedbackModal'
import { StudyJamModal } from './StudyJams/StudyJamModal'
import { useAppStore } from '../store/useAppStore'
import type { SelectedSubject } from '../types/app';
interface AppOverlaysProps {
    selectedSubject: SelectedSubject | null;
    setSelectedSubject: (subject: SelectedSubject | null) => void;
    isFeedbackOpen: boolean;
    isFeedbackOpen: boolean;
    setIsFeedbackOpen: (open: boolean) => void;
}

export function AppOverlays({ 
    selectedSubject, setSelectedSubject, 
    isFeedbackOpen, setIsFeedbackOpen
}: AppOverlaysProps) {
    const isStudyJamOpen = useAppStore(s => s.isStudyJamOpen);
    const setIsStudyJamOpen = useAppStore(s => s.setIsStudyJamOpen);
    return (
        <>
            <SubjectFileDrawer lesson={selectedSubject} isOpen={!!selectedSubject} onClose={() => setSelectedSubject(null)} />
            <WelcomeModal />
            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
            <StudyJamModal isOpen={isStudyJamOpen} onClose={() => setIsStudyJamOpen(false)} />
        </>
    );
}
