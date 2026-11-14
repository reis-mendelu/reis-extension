import { WelcomeModal } from './Onboarding/WelcomeModal';
import { SubjectFileDrawer } from './SubjectFileDrawer';
import { FeedbackModalHost } from './Feedback/FeedbackModalHost';
import { EduroamDrawer } from './Eduroam/EduroamDrawer';
import { SuggestionsToast } from './AdminConsole/SuggestionsToast';
import { DocumentsDrawer } from './StudyDocuments/DocumentsDrawer';
import { ImpersonationDrawer } from './Impersonation/ImpersonationDrawer';
import { ImpersonationBanner } from './Impersonation/ImpersonationBanner';
import type { SelectedSubject } from '../types/app';
import { currentSchool } from '../utils/school';
interface AppOverlaysProps {
  selectedSubject: SelectedSubject | null;
  setSelectedSubject: (subject: SelectedSubject | null) => void;
}

export function AppOverlays({ selectedSubject, setSelectedSubject }: AppOverlaysProps) {
  return (
    <>
      <SubjectFileDrawer
        lesson={selectedSubject}
        isOpen={!!selectedSubject}
        onClose={() => setSelectedSubject(null)}
      />
      {/* MENDELU's welcome (eduroam set-up) means nothing to another school. */}
      {currentSchool.has('welcome') && <WelcomeModal />}
      <FeedbackModalHost />
      {currentSchool.has('eduroam') && <EduroamDrawer />}
      {currentSchool.has('reports') && <SuggestionsToast />}
      {currentSchool.has('studyDocuments') && <DocumentsDrawer />}
      {/* reIS admins only. The phone tree mounts its own sheet and a banner row. */}
      {currentSchool.has('impersonation') && <ImpersonationDrawer />}
      {currentSchool.has('impersonation') && <ImpersonationBanner variant="floating" />}
    </>
  );
}
