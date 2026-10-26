import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Society } from '../types/events';
import { listedSocieties, resolveSociety } from '../utils/societies/resolveSociety';

/**
 * A society by id, re-rendering when the catalog arrives or changes. Selects
 * the catalog record (a stable reference) and resolves outside the selector:
 * resolving inside would build a new neutral object each call and loop.
 */
export function useSociety(id: string | null | undefined): Society | null {
  const catalog = useAppStore((s) => s.societies);
  return useMemo(() => (id ? resolveSociety(catalog, id) : null), [catalog, id]);
}

/** Active societies in catalog order: pickers and the subscription list. */
export function useListedSocieties(): Society[] {
  const catalog = useAppStore((s) => s.societies);
  return useMemo(() => listedSocieties(catalog), [catalog]);
}
