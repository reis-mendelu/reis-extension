import { WelcomeModal } from './Onboarding/WelcomeModal'
import { SubjectFileDrawer } from './SubjectFileDrawer'
import { OutlookSyncHint } from './OutlookSyncHint'
import { FeedbackModal } from './Feedback/FeedbackModal'
import { TutorialModal } from './Tutorials'

export function AppOverlays({ 
    selectedSubject, setSelectedSubject, weekNavCount, outlookSyncEnabled, 
    openSettingsRef, isFeedbackOpen, setIsFeedbackOpen, selectedTutorial, setSelectedTutorial 
}: any) {
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
