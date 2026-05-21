import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { PersonProfile } from '../../api/personProfile';

export interface UsePersonProfileResult {
    profile: PersonProfile | null;
    isLoading: boolean;
    error: string | undefined;
}

export function usePersonProfile(personId: number | undefined): UsePersonProfileResult {
    const entry = useAppStore(s => personId !== undefined ? s.personProfiles[personId] : undefined);
    const isLoading = useAppStore(s => personId !== undefined ? !!s.personProfilesLoading[personId] : false);

    useEffect(() => {
        if (personId === undefined) return;
        useAppStore.getState().fetchPersonProfileById(personId);
    }, [personId]);

    return {
        profile: entry?.data ?? null,
        isLoading: personId !== undefined && (isLoading || entry === undefined),
        error: entry?.error,
    };
}
