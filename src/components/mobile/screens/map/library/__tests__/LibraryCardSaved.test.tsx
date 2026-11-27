import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../../../mobile/library/transport', () => ({
  canBookLibrary: () => true,
  nativeBookingsHttp: vi.fn(),
}));

import { LibraryCard } from '../LibraryCard';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { NOW, seedCard } from './libraryCardFixture';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  seedCard();
});
afterEach(() => vi.useRealTimers());

describe('LibraryCard: the library’s last answer, kept on the device', () => {
  it('shows the grid at once with when it was taken, while the new answer is read', () => {
    const at = new Date('2026-11-16T09:12:00+01:00').getTime();
    useLibraryStore.setState({ status: 'loading', fetchedAt: null, savedAt: at });
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByText('Stav z 09:12 · obnovuji…')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Týmová 1, \d\d:00/ }).length).toBeGreaterThan(0);
  });

  it('says it could not refresh when the read failed, and keeps the grid', () => {
    const at = new Date('2026-11-16T09:12:00+01:00').getTime();
    useLibraryStore.setState({ status: 'idle', fetchedAt: null, savedAt: at });
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.getByText('Stav z 09:12, obnovit se nepodařilo')).toBeTruthy();
  });

  it('shows no note for an answer that has just come from the library', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    expect(screen.queryByText(/Stav z/)).toBeNull();
  });
});
