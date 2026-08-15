import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { PersonProfile } from '../../api/personProfile';

export interface UsePersonProfileResult {
  profile: PersonProfile | null;
  isLoading: boolean;
  error: string | undefined;
}

export function usePersonProfile(personId: number | undefined): UsePersonProfileResult {
  const entry = useAppStore((s) =>
    personId !== undefined ? s.personProfiles[personId] : undefined
  );
  const isLoading = useAppStore((s) =>
    personId !== undefined ? !!s.personProfilesLoading[personId] : false
  );
  const language = useAppStore((s) => s.language);

  // `language` is a dependency, not decoration: the card is a mounted
  // component, so without it a student who switches language keeps reading the
  // card they opened — the slice's language-aware cache never gets asked again.
  useEffect(() => {
    if (personId === undefined) return;
    useAppStore.getState().fetchPersonProfileById(personId);
  }, [personId, language]);

  // A cached entry in the language the student just left is not this card's
  // data any more; showing it would flash the old language until the refetch
  // lands.
  const isStale = entry !== undefined && entry.lang !== language;

  return {
    profile: isStale ? null : (entry?.data ?? null),
    isLoading: personId !== undefined && (isLoading || entry === undefined || isStale),
    error: isStale ? undefined : entry?.error,
  };
}
