import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('for a reis_admin, lists the personas on Profil and switches in one tap', () => {
    const go = vi.fn(async () => true);
    useAppStore.setState({ adminRole: 'reis_admin', switchToPersona: go });
    render(<ProfileScreen />);
    expect(screen.getByRole('radio', { name: /Já/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /Správa zeleně · B-RASZ/ }));
    expect(go).toHaveBeenCalledWith('zf');
  });

  it('"Jiný obor…" opens the picker sheet and asks for the options', () => {
    const load = vi.fn(async () => {});
    useAppStore.setState({ adminRole: 'reis_admin', loadImpersonationOptions: load });
    render(<ProfileScreen />);
    fireEvent.click(screen.getByRole('radio', { name: /Jiný obor…/ }));
    expect(load).toHaveBeenCalledOnce();
    expect(useAppStore.getState().mobileSheets.map((s) => s.kind)).toContain('impersonation');
  });
});
