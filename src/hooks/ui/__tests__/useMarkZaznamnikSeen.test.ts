import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { store } = vi.hoisted(() => ({
  store: {
    zaznamnikNewPoints: {} as Record<string, unknown[]>,
    markZaznamnikSeen: vi.fn(async () => undefined),
    odevzdavarnyNew: [] as string[],
    odevzdavarny: [
      { odevzdavarnaId: '9001', courseId: 'V', name: 'a' },
      { odevzdavarnaId: '9002', courseId: 'P', name: 'b' },
    ],
    subjects: { data: { 'EBC-VWA': { subjectId: 'V' }, 'EBC-PS': { subjectId: 'P' } } },
    markBoxesSeen: vi.fn(async () => undefined),
  },
}));
vi.mock('../../../store/useAppStore', () => ({
  useAppStore: (sel: (s: typeof store) => unknown) => sel(store),
}));

import { useMarkZaznamnikSeen } from '../useMarkZaznamnikSeen';

describe('useMarkZaznamnikSeen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.zaznamnikNewPoints = { 'EBC-PS': [{ label: 'a', value: '1' }] };
    store.odevzdavarnyNew = [];
  });

  it('clears a subject once its záznamník is on screen', () => {
    renderHook(() => useMarkZaznamnikSeen('EBC-PS', 'zaznamnik', true));
    expect(store.markZaznamnikSeen).toHaveBeenCalledWith('EBC-PS');
  });

  it('leaves it while another tab is showing, or the drawer is closed', () => {
    renderHook(() => useMarkZaznamnikSeen('EBC-PS', 'files', true));
    renderHook(() => useMarkZaznamnikSeen('EBC-PS', 'zaznamnik', false));
    expect(store.markZaznamnikSeen).not.toHaveBeenCalled();
  });

  it('does nothing for a subject with nothing new', () => {
    renderHook(() => useMarkZaznamnikSeen('EBC-VWA', 'zaznamnik', true));
    expect(store.markZaznamnikSeen).not.toHaveBeenCalled();
  });

  // New submission boxes live on the same tab, so they clear the same way.
  it('clears new submission boxes once the záznamník is on screen', () => {
    store.odevzdavarnyNew = ['9001'];
    renderHook(() => useMarkZaznamnikSeen('EBC-VWA', 'zaznamnik', true));
    expect(store.markBoxesSeen).toHaveBeenCalledWith('EBC-VWA');
  });

  // A box waiting in another subject must not hide one that arrives here
  // while the student is looking.
  it("clears only when the new box is this subject's", () => {
    store.odevzdavarnyNew = ['9002'];
    renderHook(() => useMarkZaznamnikSeen('EBC-VWA', 'zaznamnik', true));
    expect(store.markBoxesSeen).not.toHaveBeenCalled();
    store.odevzdavarnyNew = ['9002', '9001'];
    renderHook(() => useMarkZaznamnikSeen('EBC-VWA', 'zaznamnik', true));
    expect(store.markBoxesSeen).toHaveBeenCalledWith('EBC-VWA');
  });

  it('leaves new boxes while another tab is showing', () => {
    store.odevzdavarnyNew = ['9001'];
    renderHook(() => useMarkZaznamnikSeen('EBC-VWA', 'files', true));
    expect(store.markBoxesSeen).not.toHaveBeenCalled();
  });
});
