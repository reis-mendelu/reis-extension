import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { store } = vi.hoisted(() => ({
  store: {
    zaznamnikNewPoints: {} as Record<string, unknown[]>,
    markZaznamnikSeen: vi.fn(async () => undefined),
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
});
