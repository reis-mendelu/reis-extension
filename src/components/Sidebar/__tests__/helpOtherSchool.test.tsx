import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// A VŠE build: the guides on reisapp.cz are MENDELU's own, so Nápověda is absent.
vi.mock('../../../utils/school', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../utils/school')>();
  const { SCHOOL_PROFILES } = await import('../../../utils/schoolProfiles');
  return { ...real, currentSchool: real.schoolFor(SCHOOL_PROFILES.vse) };
});
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));

const { HelpRow } = await import('../../mobile/screens/profile/HelpRow');
const { ProfilePopup } = await import('../ProfilePopup');
const { useAppStore } = await import('../../../store/useAppStore');

describe('Nápověda outside MENDELU', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' }));

  it('has no Nápověda row on the phone', () => {
    render(<HelpRow />);
    expect(screen.queryByText('Nápověda')).not.toBeInTheDocument();
  });

  it('has no Nápověda link in the extension', () => {
    render(<ProfilePopup isOpen />);
    expect(screen.queryByText('Nápověda')).not.toBeInTheDocument();
  });
});
