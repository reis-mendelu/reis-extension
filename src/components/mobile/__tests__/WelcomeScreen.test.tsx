import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';
import { useAppStore } from '../../../store/useAppStore';
import { useEduroamSetup } from '../../../hooks/data/useEduroamSetup';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../mobile/eduroamNative';

vi.mock('../../../hooks/data/useEduroamSetup', () => ({ useEduroamSetup: vi.fn() }));
vi.mock('../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn().mockReturnValue(false),
  nativeEduroamTarget: vi.fn().mockReturnValue(null),
}));

type HookState = ReturnType<typeof useEduroamSetup>;

function hook(over: Partial<HookState> = {}): HookState {
  return {
    status: 'idle',
    target: 'ios',
    selectTarget: vi.fn(),
    password: null,
    error: null,
    outcome: null,
    run: vi.fn(),
    reset: vi.fn(),
    openProfilesSettings: vi.fn(),
    ...over,
  };
}

/** `os` null = off Capacitor (the web dev host); otherwise the phone OS. */
function setup(o: { os?: 'ios' | 'android' | null; hookState?: Partial<HookState> } = {}) {
  const os = o.os ?? null;
  vi.mocked(nativeEduroamTarget).mockReturnValue(os);
  vi.mocked(canConfigureEduroamNatively).mockReturnValue(os !== null);
  const h = hook(o.hookState);
  vi.mocked(useEduroamSetup).mockReturnValue(h);
  const dismissWelcome = vi.fn().mockResolvedValue(undefined);
  const setLanguage = vi.fn();
  useAppStore.setState({ language: 'cz', dismissWelcome, setLanguage } as never);
  render(<WelcomeScreen />);
  return { h, dismissWelcome, setLanguage };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WelcomeScreen', () => {
  it("off Capacitor there is no Wi-Fi card, just the title, language and Let's go", () => {
    const { dismissWelcome } = setup();
    expect(screen.getByText('Vítej v reISu')).toBeInTheDocument();
    expect(screen.queryByText('Nastavit eduroam')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jdeme na to' }));
    expect(dismissWelcome).toHaveBeenCalledOnce();
  });

  it('switches language with a CZ | EN toggle that reads in either language', () => {
    const { setLanguage } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(setLanguage).toHaveBeenCalledWith('en');
  });

  it('on the phone shows the card and runs the native setup on tap', () => {
    const { h } = setup({ os: 'android' });
    expect(screen.getByText('Školní Wi-Fi jedním klepnutím')).toBeInTheDocument();
    expect(screen.getByText(/nastaví eduroam z tvého certifikátu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nastavit eduroam' }));
    expect(h.run).toHaveBeenCalledWith('android');
  });

  it('says who built reIS under the title', () => {
    setup();
    expect(screen.getByText(/Vytvořeno studenty pro studenty/)).toBeInTheDocument();
  });

  it('hands the phone OS to the hook so the password prefetch runs on the phone only', () => {
    setup({ os: 'ios' });
    expect(useEduroamSetup).toHaveBeenLastCalledWith('ios');
    cleanup();
    setup();
    expect(useEduroamSetup).toHaveBeenLastCalledWith(undefined);
  });

  it('Not now dismisses without touching eduroam', () => {
    const { h, dismissWelcome } = setup({ os: 'ios' });
    fireEvent.click(screen.getByRole('button', { name: 'Teď ne' }));
    expect(dismissWelcome).toHaveBeenCalledOnce();
    expect(h.run).not.toHaveBeenCalled();
  });

  it("after a save the card is done, the button is gone and the footer says Let's go", () => {
    setup({ os: 'android', hookState: { status: 'done', outcome: 'saved' } });
    expect(screen.getByText('Hotovo, na fakultě se připojíš sám')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nastavit eduroam' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jdeme na to' })).toBeInTheDocument();
    expect(screen.queryByText(/nastaví eduroam z tvého certifikátu/)).not.toBeInTheDocument();
    // Android's saved network is the student's own; the lifetime caveat is iOS-only.
    expect(screen.queryByText(/dokud máte reIS/)).not.toBeInTheDocument();
  });

  it('already-configured counts as done, and iOS gets the lifetime line', () => {
    setup({ os: 'ios', hookState: { status: 'done', outcome: 'already-configured' } });
    expect(screen.getByText('Hotovo, na fakultě se připojíš sám')).toBeInTheDocument();
    expect(screen.getByText(/dokud máte reIS nainstalovaný/)).toBeInTheDocument();
  });

  it('a cancelled system dialog goes quietly back to the button', () => {
    setup({ os: 'ios', hookState: { status: 'idle', outcome: 'cancelled' } });
    expect(screen.getByRole('button', { name: 'Nastavit eduroam' })).toBeInTheDocument();
    expect(screen.queryByText(/Nepovedlo se/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teď ne' })).toBeInTheDocument();
  });

  it('a failure says so in one line and lets the student continue', () => {
    const { dismissWelcome } = setup({
      os: 'android',
      hookState: { status: 'error', outcome: 'failed' },
    });
    expect(screen.getByText('Nepovedlo se, nastavíš to později v profilu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nastavit eduroam' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));
    expect(dismissWelcome).toHaveBeenCalledOnce();
  });

  it('a rejection before the OS was reached is also the failure line', () => {
    setup({
      os: 'android',
      hookState: { status: 'error', outcome: null, error: 'Failed to fetch' },
    });
    expect(screen.getByText(/Nepovedlo se/)).toBeInTheDocument();
  });

  it('shows the working state while the OS dialog is up', () => {
    setup({ os: 'ios', hookState: { status: 'working' } });
    expect(screen.getByText('Otevírám nastavení Wi-Fi…')).toBeInTheDocument();
  });
});
