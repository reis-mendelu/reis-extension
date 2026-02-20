import { BookOpen } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { TutoringMatchCard } from './TutoringMatchCard';

export function StudyJamSuggestions() {
    const suggestions = useAppStore(s => s.studyJamSuggestions);
    const optIns = useAppStore(s => s.studyJamOptIns);
    const match = useAppStore(s => s.studyJamMatch);
    const optInStudyJam = useAppStore(s => s.optInStudyJam);
    const requestTutorMatch = useAppStore(s => s.requestTutorMatch);
    const cancelOptIn = useAppStore(s => s.cancelOptIn);

    const optInEntries = Object.entries(optIns);
    const hasContent = suggestions.length > 0 || optInEntries.length > 0 || match !== null;

    if (!hasContent) return null;

    return (
        <div className="border-b border-base-300 bg-base-200/40">
            <div className="px-3 py-2">
                <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <BookOpen size={11} />
                    Study Jams
                </p>

                {match && <TutoringMatchCard />}

                {optInEntries.map(([courseCode, optIn]) => (
                    <div key={courseCode} className="flex items-center justify-between py-1.5 text-sm">
                        {optIn.role === 'tutor' ? (
                            <span className="text-base-content/70">
                                Čekáš na tutea pro <span className="font-medium">{courseCode}</span>
                            </span>
                        ) : (
                            <span className="text-base-content/70 flex items-center gap-1.5">
                                <span className="loading loading-spinner loading-xs text-primary"></span>
                                Hledám tutora pro <span className="font-medium">{courseCode}</span>
                            </span>
                        )}
                        <button
                            onClick={() => cancelOptIn(courseCode)}
                            className="text-xs text-base-content/40 hover:text-error ml-2 underline"
                        >
                            zrušit
                        </button>
                    </div>
                ))}

                {suggestions.map(s => (
                    <div key={s.courseCode} className="flex items-center justify-between py-1.5 text-sm">
                        {s.role === 'tutor' ? (
                            <span className="text-base-content/70">
                                Mohl bys tutorit <span className="font-medium">{s.courseName}</span>
                            </span>
                        ) : (
                            <span className="text-base-content/70">
                                Dostupný tutor pro <span className="font-medium">{s.courseName}</span>?
                            </span>
                        )}
                        <button
                            onClick={() => s.role === 'tutor'
                                ? optInStudyJam(s.courseCode, s.courseName, 'tutor')
                                : requestTutorMatch(s.courseCode, s.courseName)
                            }
                            className="btn btn-xs btn-primary ml-2 shrink-0"
                        >
                            {s.role === 'tutor' ? 'Chci tutorit' : 'Hledat tutora'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
