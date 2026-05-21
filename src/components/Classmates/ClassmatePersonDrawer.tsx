import { useEffect } from 'react';
import { User, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { usePersonProfile } from '../../hooks/data/usePersonProfile';
import { ISBacklink } from '../SubjectFileDrawer/ISBacklink';
import { ClassmatePersonDetail } from './ClassmatePersonDetail';
import type { Classmate } from '../../types/classmates';

interface ClassmatePersonDrawerProps {
    classmate: Classmate | null;
    onClose: () => void;
}

function normalizePhotoUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://is.mendelu.cz${url}`;
}

export function ClassmatePersonDrawer({ classmate, onClose }: ClassmatePersonDrawerProps) {
    const { t } = useTranslation();
    const { profile, isLoading } = usePersonProfile(classmate?.personId);

    useEffect(() => {
        if (!classmate) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [classmate, onClose]);

    if (!classmate) return null;

    const profileUrl = `https://is.mendelu.cz/auth/lide/clovek.pl?id=${classmate.personId};lang=cz`;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end items-stretch p-0 sm:p-4 isolate"
            onClick={e => e.stopPropagation()}
        >
            <div className="absolute inset-0 bg-black/15 animate-in fade-in" onClick={onClose} />
            <div className="w-full flex justify-end items-start h-full pt-0 pb-0 sm:pt-10 sm:pb-10 relative z-10 pointer-events-none">
                <div
                    role="dialog"
                    className="bg-base-100 shadow-2xl rounded-2xl flex flex-col h-full animate-in slide-in-from-right pointer-events-auto border border-base-300 w-full sm:w-[600px] relative"
                >
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('common.close')}
                        className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex-1 overflow-y-auto">
                        <div className="bg-gradient-to-b from-base-200/40 to-transparent px-6 pt-10 pb-6 flex flex-col items-center">
                            <div className="avatar mb-4">
                                <div className="w-32 h-32 rounded-full ring-1 ring-base-200 ring-offset-base-100 ring-offset-2">
                                    {classmate.photoUrl ? (
                                        <img
                                            src={normalizePhotoUrl(classmate.photoUrl)}
                                            alt={classmate.name}
                                            className="w-full h-full object-cover scale-[1.05]"
                                            onError={e => {
                                                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                                                if (fb) fb.style.display = 'flex';
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className="bg-neutral text-neutral-content w-full h-full items-center justify-center"
                                        style={{ display: classmate.photoUrl ? 'none' : 'flex' }}
                                    >
                                        <User size={48} strokeWidth={1.5} />
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-center leading-tight">
                                {classmate.name}
                            </h2>
                            <p className="mt-2 text-[11px] font-mono text-base-content/40">
                                ID: {classmate.personId}
                            </p>
                        </div>

                        <ClassmatePersonDetail
                            profile={profile}
                            isLoading={isLoading}
                            studyInfoFromClassmate={classmate.studyInfo}
                        />

                        <div className="px-4 pb-4">
                            <ISBacklink href={profileUrl} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
