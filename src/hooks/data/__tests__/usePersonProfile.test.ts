import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Language } from '../../../store/types';

interface Entry {
  data: { name: string } | null;
  fetchedAt: number;
  lang: Language;
  error?: string;
}

interface StoreShape {
  language: Language;
  personProfiles: Record<number, Entry>;
  personProfilesLoading: Record<number, boolean>;
  fetchPersonProfileById: ReturnType<typeof vi.fn>;
}

vi.mock('../../../store/useAppStore', () => {
  const state: StoreShape = {
    language: 'cz',
    personProfiles: {},
    personProfilesLoading: {},
    fetchPersonProfileById: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useAppStore: any = (selector: (s: StoreShape) => unknown) => selector(state);
  useAppStore.getState = () => state;
  useAppStore.__state = state;
  return { useAppStore };
});

import { usePersonProfile } from '../usePersonProfile';
import { useAppStore } from '../../../store/useAppStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = (useAppStore as any).__state as StoreShape;

const czechEntry: Entry = { data: { name: 'Jan Novák' }, fetchedAt: Date.now(), lang: 'cz' };

describe('usePersonProfile', () => {
  beforeEach(() => {
    store.language = 'cz';
    store.personProfiles = {};
    store.personProfilesLoading = {};
    store.fetchPersonProfileById = vi.fn();
  });

  it('asks for the profile on mount', () => {
    renderHook(() => usePersonProfile(42));
    expect(store.fetchPersonProfileById).toHaveBeenCalledWith(42);
  });

  it('serves a cached entry in the current language', () => {
    store.personProfiles = { 42: czechEntry };
    const { result } = renderHook(() => usePersonProfile(42));
    expect(result.current.profile).toEqual({ name: 'Jan Novák' });
    expect(result.current.isLoading).toBe(false);
  });

  it('re-requests the profile when the student switches language', () => {
    store.personProfiles = { 42: czechEntry };
    const { rerender } = renderHook(() => usePersonProfile(42));
    expect(store.fetchPersonProfileById).toHaveBeenCalledTimes(1);

    // The card is a mounted component. Without `language` in the effect's
    // dependencies nothing ever asks again, and the student reads the card
    // in the language they just left — #206 with extra steps.
    store.language = 'en';
    rerender();

    expect(store.fetchPersonProfileById).toHaveBeenCalledTimes(2);
  });

  it('shows loading, not the old language, while the new one is on its way', () => {
    store.personProfiles = { 42: czechEntry };
    store.language = 'en';
    const { result } = renderHook(() => usePersonProfile(42));

    expect(result.current.profile).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('hides an error left behind by the language the student left', () => {
    store.personProfiles = {
      42: { data: null, fetchedAt: Date.now(), lang: 'cz', error: 'network' },
    };
    store.language = 'en';
    const { result } = renderHook(() => usePersonProfile(42));

    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('reports an error raised in the current language', () => {
    store.personProfiles = {
      42: { data: null, fetchedAt: Date.now(), lang: 'cz', error: 'network' },
    };
    const { result } = renderHook(() => usePersonProfile(42));

    expect(result.current.error).toBe('network');
  });

  it('does nothing without a person', () => {
    const { result } = renderHook(() => usePersonProfile(undefined));
    expect(store.fetchPersonProfileById).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
