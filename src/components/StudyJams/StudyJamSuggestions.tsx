import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { TutoringMatchCard } from './TutoringMatchCard';
import { ReisLogo } from '../ReisLogo';

export function StudyJamSuggestions({ onClose }: { onClose: () => void }) {
    const suggestions = useAppStore(s => s.studyJamSuggestions);
    const match = useAppStore(s => s.studyJamMatch);
    const optIns = useAppStore(s => s.studyJamOptIns);
    const cancelOptIn = useAppStore(s => s.cancelOptIn);
    const setSelected = useAppStore(s => s.setSelectedStudyJamSuggestion);
    const setIsStudyJamOpen = useAppStore(s => s.setIsStudyJamOpen);

    const optInEntries = Object.entries(optIns);
    const hasContent = suggestions.length > 0 || match !== null || optInEntries.length > 0;

    if (!hasContent) return null;

    const openModal = (suggestion: { courseCode: string; courseName: string; role: 'tutor' | 'tutee' }) => {
        setSelected(suggestion);
        setIsStudyJamOpen(true);
        onClose();
    };

    return (
        <>
            {match && <TutoringMatchCard />}

            {optInEntries.map(([courseCode, { role }]) => (
                <div
                    key={courseCode}
                    className="w-full p-4 flex items-center gap-3 border-b border-base-300"
                >
                    <ReisAvatar />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-base-content/70 line-clamp-1">
                            {role === 'tutor' ? 'Čekám na tutee' : 'Čekám na tutora'} — {courseCode}
                        </div>
                    </div>
                    <button
                        onClick={() => cancelOptIn(courseCode)}
                        className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
                        title="Zrušit registraci"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}

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
                <ReisLogo className="w-[1.6rem] h-[1.6rem] ml-0.5" />
            </div>
        </div>
    );
}
