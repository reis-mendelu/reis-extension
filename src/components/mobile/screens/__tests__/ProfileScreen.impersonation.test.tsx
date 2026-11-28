import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { overlayWrite } from '../../../../store/overlay/overlayGuard';

vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto: () => null }));

beforeEach(() =>
  useAppStore.setState(
    overlayWrite({
      language: 'cz' as const,
      mobileSheets: [],
      impersonation: null,
      personaRows: {},
    })
  )
);

describe('ProfileScreen — view as (personas)', () => {
  it('is absent for everyone but a reis_admin', () => {
    useAppStore.setState({ adminRole: 'association' });
    render(<ProfileScreen />);
    expect(screen.queryByRole('radiogroup', { name: 'Zobrazit jako' })).toBeNull();
    expect(screen.queryByText('Jiný obor…')).toBeNull();
  });

  // A reIS admin's list moved to the avatar's sheet (decision #16,
  // 2026-11-28): ProfileScreen.personas.test.tsx and PersonasSheet.test.tsx.
  it('is not inline for a reis_admin either', () => {
    useAppStore.setState({ adminRole: 'reis_admin' });
    render(<ProfileScreen />);
    expect(screen.queryByRole('radiogroup', { name: 'Zobrazit jako' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Zobrazit jako' })).toBeInTheDocument();
  });
});
