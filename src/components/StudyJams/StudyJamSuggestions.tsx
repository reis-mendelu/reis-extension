import { useAppStore } from '../../store/useAppStore';
import { TutoringMatchCard } from './TutoringMatchCard';
import { MENDELU_LOGO_PATH } from '../../constants/icons';

export function StudyJamSuggestions({ onClose }: { onClose: () => void }) {
    const suggestions = useAppStore(s => s.studyJamSuggestions);
    const match = useAppStore(s => s.studyJamMatch);
    const setSelected = useAppStore(s => s.setSelectedStudyJamSuggestion);
    const setIsStudyJamOpen = useAppStore(s => s.setIsStudyJamOpen);

    const hasContent = suggestions.length > 0 || match !== null;

    if (!hasContent) return null;

    const openModal = (suggestion: { courseCode: string; courseName: string; role: 'tutor' | 'tutee' }) => {
        setSelected(suggestion);
        setIsStudyJamOpen(true);
        onClose();
    };

    return (
        <>
            {match && <TutoringMatchCard />}



            {suggestions.map(s => (
                <button
                    key={s.courseCode}
                    onClick={() => openModal(s)}
                    className="w-full p-4 hover:bg-base-200 transition-colors text-left flex items-center gap-3 border-b border-base-300"
                >
                    <ReisAvatar />
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-base-content line-clamp-1">
                            {s.role === 'tutor'
                                ? `Zvládl jsi ${s.courseName} levou zadní?`
                                : `Chceš doučko z ${s.courseName}?`}
                        </div>
                    </div>
                </button>
            ))}
        </>
    );
}

function ReisAvatar() {
    return (
        <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-black/5">
                <img src={MENDELU_LOGO_PATH} alt="reIS" className="w-[1.6rem] h-[1.6rem] object-contain ml-0.5" />
            </div>
        </div>
    );
}
