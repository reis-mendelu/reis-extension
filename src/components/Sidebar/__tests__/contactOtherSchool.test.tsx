import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// A VŠE build: no report form (it would be a Supabase row, and VŠE sends reIS
// nothing), so the profile popup offers an e-mail the student writes instead.
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

const { ProfilePopup } = await import('../ProfilePopup');
const { useAppStore } = await import('../../../store/useAppStore');

describe('reporting a bug outside MENDELU', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' }));

  it('is an e-mail to reIS, not the report form', () => {
    render(<ProfilePopup isOpen />);
    const link = screen.getByRole('link', { name: 'Nahlásit chybu / napsat nám' });
    expect(link.getAttribute('href')).toBe('mailto:reis.mendelu@gmail.com');
    expect(screen.queryByText('Nahlásit chybu / Nápad')).not.toBeInTheDocument();
  });
});
