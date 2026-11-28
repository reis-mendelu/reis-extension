import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { BottomActions } from '../BottomActions';
import { useAppStore } from '../../../store/useAppStore';
import { overlayWrite } from '../../../store/overlay/overlayGuard';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../hooks/useUserParams', () => ({
  useUserParams: () => ({ params: { fullName: 'Jana Nováková', email: null, studentId: '1' } }),
}));

const avatar = () => screen.getByRole('button', { name: /Profil/ });
const personaDialog = () => screen.queryByRole('radiogroup', { name: 'Zobrazit jako' });
// The profile popup's own heading row: language is set nowhere else.
const profilePopup = () => screen.queryByText('Jazyk');

/**
 * The avatar opens the persona dialog for a reIS admin; the profile is one row
 * down (design 2026-11-27 §6, decision #16). A student's avatar is untouched.
 */
describe('the sidebar avatar', () => {
  beforeEach(() => {
    useAppStore.setState(
      overlayWrite({
        language: 'cz' as const,
        adminRole: null,
        adminSession: null,
        impersonation: null,
        personaRows: {},
      })
    );
  });
  afterEach(cleanup);

  it("opens a student's profile popup, as before", () => {
    render(<BottomActions />);
    fireEvent.mouseEnter(avatar());
    expect(profilePopup()).toBeInTheDocument();
    expect(personaDialog()).toBeNull();
  });

  it("opens an admin's persona dialog instead of the profile popup", () => {
    useAppStore.setState({ adminRole: 'reis_admin' });
    render(<BottomActions />);
    fireEvent.click(avatar());
    expect(personaDialog()).toBeInTheDocument();
    expect(profilePopup()).toBeNull();
  });

  it('"Profil a nastavení" swaps the dialog for the profile popup', () => {
    useAppStore.setState({ adminRole: 'reis_admin' });
    render(<BottomActions />);
    fireEvent.click(avatar());
    fireEvent.click(screen.getByRole('button', { name: /Profil a nastavení/ }));
    expect(profilePopup()).toBeInTheDocument();
    expect(personaDialog()).toBeNull();
    // Focus moves into the profile rather than falling to <body>.
    expect(screen.getByTestId('persona-panel').contains(document.activeElement)).toBe(true);
  });

  it('opens on the persona list again after it was closed on the profile', () => {
    useAppStore.setState({ adminRole: 'reis_admin' });
    render(<BottomActions />);
    fireEvent.click(avatar());
    fireEvent.click(screen.getByRole('button', { name: /Profil a nastavení/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(profilePopup()).toBeNull();
    fireEvent.click(avatar());
    expect(personaDialog()).toBeInTheDocument();
  });

  it('Esc and a click outside close the dialog', () => {
    useAppStore.setState({ adminRole: 'reis_admin' });
    render(<BottomActions />);
    fireEvent.click(avatar());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(personaDialog()).toBeNull();
    expect(avatar()).toHaveFocus();
    fireEvent.click(avatar());
    fireEvent.mouseDown(document.body);
    expect(personaDialog()).toBeNull();
  });

  it('"Jiný obor…" opens the picker drawer and closes the dialog', () => {
    const openPicker = vi.fn();
    useAppStore.setState({ adminRole: 'reis_admin', openImpersonationPicker: openPicker });
    render(<BottomActions />);
    fireEvent.click(avatar());
    fireEvent.click(screen.getByRole('radio', { name: /Jiný obor/ }));
    expect(openPicker).toHaveBeenCalledOnce();
    expect(personaDialog()).toBeNull();
  });

  it('picking a persona applies it and closes the dialog', async () => {
    const go = vi.fn(async () => true);
    useAppStore.setState({ adminRole: 'reis_admin', switchToPersona: go });
    render(<BottomActions />);
    fireEvent.click(avatar());
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /IT · B-OI/ }));
    });
    expect(go).toHaveBeenCalledWith('it');
    expect(personaDialog()).toBeNull();
  });

  it('stays open on a failed switch, so its row can say why', async () => {
    const go = vi.fn(async () => false);
    useAppStore.setState({ adminRole: 'reis_admin', switchToPersona: go });
    render(<BottomActions />);
    fireEvent.click(avatar());
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /IT · B-OI/ }));
    });
    expect(personaDialog()).toBeInTheDocument();
  });
});
