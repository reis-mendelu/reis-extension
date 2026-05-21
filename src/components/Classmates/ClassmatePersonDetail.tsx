import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { PersonProfile } from '../../api/personProfile';

interface ClassmatePersonDetailProps {
    profile: PersonProfile | null;
    isLoading: boolean;
    studyInfoFromClassmate: string;
}

export function ClassmatePersonDetail({
    profile,
    isLoading,
    studyInfoFromClassmate,
}: ClassmatePersonDetailProps) {
    const { t } = useTranslation();

    const hasContact = !!(profile?.universityEmail || profile?.privateEmail);
    const hasStudiesData = !!(profile?.programmeName || profile?.studyTypeSentence || profile?.yearSemesterSentence);
    const showStudies = hasStudiesData || !!studyInfoFromClassmate;

    return (
        <div className="px-6 py-4 space-y-4">
            {showStudies && (
                <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">
                        {t('classmates.studies')}
                    </h3>
                    <div className="rounded-xl border border-base-200 bg-base-100 p-4">
                        {profile?.programmeName ? (
                            <>
                                <div className="text-sm font-semibold leading-snug">
                                    {profile.programmeName}
                                </div>
                                {profile.programmeCode && (
                                    <div className="text-[11px] font-mono text-base-content/40 mt-0.5">
                                        {profile.programmeCode}
                                    </div>
                                )}
                            </>
                        ) : (
                            studyInfoFromClassmate && (
                                <p className="text-sm text-base-content/70">{studyInfoFromClassmate}</p>
                            )
                        )}
                        {profile?.studyTypeSentence && (
                            <p className="mt-2 text-sm text-base-content/70">{profile.studyTypeSentence}</p>
                        )}
                        {profile?.yearSemesterSentence && (
                            <p className="mt-1 text-sm text-base-content/70">{profile.yearSemesterSentence}</p>
                        )}
                    </div>
                </section>
            )}

            {isLoading && !profile ? (
                <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">
                        {t('classmates.contact')}
                    </h3>
                    <SectionSkeleton />
                </section>
            ) : hasContact && (
                <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">
                        {t('classmates.contact')}
                    </h3>
                    <div className="rounded-xl border border-base-200 bg-base-100 divide-y divide-base-200">
                        {profile!.universityEmail && (
                            <EmailRow label={t('classmates.universityEmail')} email={profile!.universityEmail} />
                        )}
                        {profile!.privateEmail && (
                            <EmailRow label={t('classmates.privateEmail')} email={profile!.privateEmail} />
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

function EmailRow({ label, email }: { label: string; email: string }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard blocked — ignore
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            aria-label={t('classmates.copyEmail')}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary/[0.03] transition-colors group"
        >
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-base-content/40 mb-0.5">
                    {label}
                </div>
                <div className="text-sm font-mono truncate text-base-content/80 group-hover:text-primary">
                    {email}
                </div>
            </div>
            <span
                className={`text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                    copied ? 'text-success' : 'text-base-content/30 group-hover:text-primary'
                }`}
            >
                {copied ? (
                    <>
                        <Check size={14} />
                        {t('classmates.copied')}
                    </>
                ) : (
                    <>
                        <Copy size={14} />
                        {t('classmates.copy')}
                    </>
                )}
            </span>
        </button>
    );
}

function SectionSkeleton() {
    return (
        <div className="rounded-xl border border-base-200 bg-base-100 p-4 space-y-2">
            <div className="h-4 w-3/4 bg-base-200 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-base-200 rounded animate-pulse" />
        </div>
    );
}
