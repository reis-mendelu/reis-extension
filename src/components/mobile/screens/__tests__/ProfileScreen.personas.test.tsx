import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

const usePersonPhoto = vi.hoisted(() => vi.fn(() => null as string | null));
vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto }));

const PHOTO = 'data:image/jpeg;base64,AAAA';

/**
 * A reIS admin's avatar opens "Zobrazit jako" on the sheet stack (decision
 * #16, 2026-11-28), photo or initials alike; the list is no longer inline on
 * Profil. A student's avatar keeps the photo lightbox (ProfileScreen.photo).
 */
describe('the profile avatar of a reIS admin', () => {
  const pushSheet = vi.fn();

  beforeEach(() => {
    pushSheet.mockClear();
    usePersonPhoto.mockReturnValue(null);
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'profile',
      mobileSheets: [],
      fullName: 'Jana Nováková',
      studentId: '123456',
      hiddenItems: { events: [], courses: [] },
      adminRole: 'reis_admin',
      adminSession: null,
      impersonation: null,
      personaRows: {},
      pushSheet,
    } as never);
  });

  it('opens the persona sheet from the photo, not the lightbox', () => {
    usePersonPhoto.mockReturnValue(PHOTO);
    render(<ProfileScreen />);
    expect(screen.queryByLabelText('Zvětšit fotku')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit jako' }));
    expect(pushSheet).toHaveBeenCalledWith({ kind: 'personas' });
  });

  it('opens it from the initials too', () => {
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('JN'));
    expect(pushSheet).toHaveBeenCalledWith({ kind: 'personas' });
  });

  it('no longer lists the personas on Profil itself', () => {
    render(<ProfileScreen />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it("a student's avatar still enlarges the photo", () => {
    useAppStore.setState({ adminRole: null } as never);
    usePersonPhoto.mockReturnValue(PHOTO);
    render(<ProfileScreen />);
    expect(screen.queryByRole('button', { name: 'Zobrazit jako' })).toBeNull();
    fireEvent.click(screen.getByLabelText('Zvětšit fotku'));
    expect(pushSheet).toHaveBeenCalledWith(expect.objectContaining({ kind: 'personPhoto' }));
  });
});
