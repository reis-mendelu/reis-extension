import { useEffect } from 'react';
import { User, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { usePersonProfile } from '../../hooks/data/usePersonProfile';
import { ISBacklink } from '../SubjectFileDrawer/ISBacklink';
import { ClassmatePersonDetail } from './ClassmatePersonDetail';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { PersonPhoto } from '../ui/PersonPhoto';
import type { Classmate } from '../../types/classmates';

interface ClassmatePersonDrawerProps {
    classmate: Classmate | null;
    onClose: () => void;
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

    const profileUrl = classmate
        ? `https://is.mendelu.cz/auth/lide/clovek.pl?id=${classmate.personId};lang=cz`
        : '';

    return (
        <AdaptiveDrawer open={!!classmate} onClose={onClose}>
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
                            <PersonPhoto
                                personId={classmate?.personId}
                                alt={classmate?.name ?? ''}
                                className="w-full h-full object-cover scale-[1.05]"
                                fallback={
                                    <div className="bg-neutral text-neutral-content w-full h-full flex items-center justify-center">
                                        <User size={48} strokeWidth={1.5} />
                                    </div>
                                }
                            />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-center leading-tight">
                        {classmate?.name}
                    </h2>
                    <p className="mt-2 text-[11px] font-mono text-base-content/40">
                        ID: {classmate?.personId}
                    </p>
                </div>

                <ClassmatePersonDetail
                    profile={profile}
                    isLoading={isLoading}
                    studyInfoFromClassmate={classmate?.studyInfo ?? ''}
                />

                <div className="px-4 pb-4">
                    <ISBacklink href={profileUrl} />
                </div>
            </div>
        </AdaptiveDrawer>
    );
}
