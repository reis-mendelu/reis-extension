import { useState } from 'react';
import { CheckSquare, Square, ExternalLink, X, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function TutoringMatchCard() {
    const { t } = useTranslation();
    const match = useAppStore(s => s.studyJamMatch);
    const hideStudyJamMatch = useAppStore(s => s.hideStudyJamMatch);
    const withdrawStudyJamMatch = useAppStore(s => s.withdrawStudyJamMatch);

    const [checklist, setChecklist] = useState([false, false]);
    const [confirmWithdraw, setConfirmWithdraw] = useState(false);

    if (!match) return null;

    const isTutee = match.myRole === 'tutee';
    const teamsUrl = 'https://teams.microsoft.com';

    const displayName = match.resolvedName ?? match.otherPartyStudentId;
    const teamsHandle = match.teamsHandle;

    const checklistItems = isTutee
        ? [t('studyJam.checklistTutorWrote'), t('studyJam.checklistConfirmedTime')]
        : [t('studyJam.checklistTuteeWrote'), t('studyJam.checklistConfirmedTime')];

    const toggle = (i: number) => setChecklist(prev => prev.map((v, idx) => idx === i ? !v : v));

    return (
        <div className="bg-success/10 border border-success/30 rounded-lg px-3 py-2.5 mb-2">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-success mb-0.5">
                        {isTutee ? t('studyJam.matchTutorFound') : t('studyJam.matchTuteeAssigned')} — {match.courseName}
                    </p>
                    <p className="text-sm font-medium truncate">
                        {displayName}
                        {teamsHandle && (
                            <span className="font-normal text-base-content/50"> • {teamsHandle}</span>
                        )}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                        <a
                            href={teamsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-xs btn-success gap-1"
                        >
                            <ExternalLink size={11} />
                            {t('studyJam.matchWriteTeams')}
                        </a>
                        {!confirmWithdraw ? (
                            <button
                                onClick={() => setConfirmWithdraw(true)}
                                className="btn btn-xs btn-ghost text-base-content/40 hover:text-error gap-1"
                            >
                                <LogOut size={11} />
                                {t('studyJam.matchUnregister')}
                            </button>
                        ) : (
                            <button
                                onClick={withdrawStudyJamMatch}
                                className="btn btn-xs btn-error gap-1"
                            >
                                {t('studyJam.matchConfirmUnregister')}
                            </button>
                        )}
                    </div>
                    <div className="mt-2 space-y-1">
                        {checklistItems.map((label, i) => (
                            <button
                                key={i}
                                onClick={() => toggle(i)}
                                className="flex items-center gap-1.5 text-xs text-base-content/70 hover:text-base-content w-full text-left"
                            >
                                {checklist[i]
                                    ? <CheckSquare size={13} className="text-success shrink-0" />
                                    : <Square size={13} className="shrink-0" />}
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={hideStudyJamMatch} className="opacity-50 hover:opacity-100 shrink-0 mt-0.5" title={t('studyJam.matchHide')} aria-label={t('studyJam.matchHide')}>
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
