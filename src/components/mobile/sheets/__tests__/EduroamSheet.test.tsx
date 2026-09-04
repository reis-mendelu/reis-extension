import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { EduroamSheet } from '../EduroamSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { useEduroamSetup } from '../../../../hooks/data/useEduroamSetup';
import { isMac, isMobile } from '../../../../utils/platform';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../../mobile/eduroamNative';

vi.mock('../../../../hooks/data/useEduroamSetup', () => ({
  useEduroamSetup: vi.fn(),
}));

vi.mock('../../../../utils/platform', () => ({
  isMac: vi.fn(),
  isMobile: vi.fn(),
}));

vi.mock('../../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn().mockReturnValue(false),
  nativeEduroamTarget: vi.fn().mockReturnValue(null),
}));

const mockedUseEduroamSetup = vi.mocked(useEduroamSetup);
const mockedIsMac = vi.mocked(isMac);
const mockedIsMobile = vi.mocked(isMobile);
const mockedCanConfigureNatively = vi.mocked(canConfigureEduroamNatively);
const mockedNativeTarget = vi.mocked(nativeEduroamTarget);

type HookState = ReturnType<typeof useEduroamSetup>;

function baseHookState(): HookState {
  return {
    status: 'idle' as const,
    target: 'windows' as const,
    selectTarget: vi.fn(),
    password: null,
    error: null,
    outcome: null,
    run: vi.fn(),
    reset: vi.fn(),
    openProfilesSettings: vi.fn(),
  };
}

/** A phone running the Capacitor app, where the OS does the setup. */
function onPhone(over: Partial<HookState> = {}, os: 'android' | 'ios' = 'android') {
  mockedIsMobile.mockReturnValue(true);
  mockedIsMac.mockReturnValue(os === 'ios');
  mockedNativeTarget.mockReturnValue(os);
  mockedCanConfigureNatively.mockReturnValue(true);
  mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), target: os, ...over });
  useAppStore.setState({ language: 'cz' } as never);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EduroamSheet', () => {
  it('renders the three numbered steps (credentials, download, install hint)', () => {
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(false);
    mockedUseEduroamSetup.mockReturnValue({
      ...baseHookState(),
      password: 'abc123',
    });
    useAppStore.setState({ language: 'cz' } as never);

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('Stáhnout eduroam profil')).toBeInTheDocument();
    expect(screen.getByText('Ve škole se připoj k síti eduroam')).toBeInTheDocument();
  });

  it('copies the credentials to the clipboard when the copy button is clicked', async () => {
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(false);
    mockedUseEduroamSetup.mockReturnValue({
      ...baseHookState(),
      password: 'my-secret-pw',
    });
    useAppStore.setState({ language: 'cz' } as never);

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<EduroamSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Zkopírovat'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('my-secret-pw'));
    vi.unstubAllGlobals();
  });

  it('downloads the platform-appropriate profile for a detected Windows device', () => {
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(false);
    const run = vi.fn();
    mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), run });
    useAppStore.setState({ language: 'cz' } as never);

    render(<EduroamSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Stáhnout eduroam profil'));

    expect(run).toHaveBeenCalledWith('windows');
  });

  it('downloads the platform-appropriate profile for a detected iOS device', () => {
    mockedIsMobile.mockReturnValue(true);
    mockedIsMac.mockReturnValue(true);
    const run = vi.fn();
    mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), run });
    useAppStore.setState({ language: 'cz' } as never);

    render(<EduroamSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Stáhnout eduroam profil'));

    expect(run).toHaveBeenCalledWith('ios');
  });

  it('calls useEduroamSetup with the detected target so the password prefetch runs immediately', () => {
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(false);
    mockedUseEduroamSetup.mockReturnValue(baseHookState());
    useAppStore.setState({ language: 'cz' } as never);

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(mockedUseEduroamSetup).toHaveBeenCalledWith('windows');
  });

  it('shows an error alert with the message when status is error, instead of failing silently', () => {
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(false);
    mockedUseEduroamSetup.mockReturnValue({
      ...baseHookState(),
      status: 'error',
      error: 'Session expired',
    });
    useAppStore.setState({ language: 'cz' } as never);

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/Session expired/)).toBeInTheDocument();
  });

  it('drops the password step on the phone — the app opens the certificate itself', () => {
    // The extraction password only exists so a human can type it into an
    // install dialog. On this path the plugin opens the PKCS#12 directly, so
    // showing the password would be handing over a credential for no reason.
    onPhone({ password: 'abc123' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.queryByText('abc123')).not.toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('offers to set eduroam up, not to download a profile', () => {
    onPhone();

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText('Nastavit eduroam')).toBeInTheDocument();
    expect(screen.queryByText('Stáhnout eduroam profil')).not.toBeInTheDocument();
  });

  it('confirms in plain language once Android has saved the network', () => {
    onPhone({ status: 'done', outcome: 'saved' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/eduroam je uložený/)).toBeInTheDocument();
  });

  /**
   * Off campus, `apply` installs the configuration and then iOS puts up its OWN
   * alert — "Unable to join the network eduroam" — because the SSID is not in
   * range. There is no API to save without attempting to join, so that alert
   * cannot be suppressed; it can only be explained before the student decides
   * what it means.
   *
   * Confirmed on the device: "I actually did get the green message ... but what
   * I'm seeing is the green message, but then a system prompt from iPad saying,
   * unable to join the network, Eduroam."
   */
  it('names the system alert it cannot suppress, so it does not read as failure', () => {
    // `saved`, not `saved-not-joined`: the device that showed iOS's "Unable to
    // join the network eduroam" alert reported a plain success with no error,
    // so the note cannot be gated on the outcome.
    onPhone({ status: 'done', outcome: 'saved' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/eduroam je uložený/)).toBeInTheDocument();
    expect(screen.getByText(/není v dosahu/)).toBeInTheDocument();
  });

  it('shows it for the off-campus outcome too', () => {
    onPhone({ status: 'done', outcome: 'saved-not-joined' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/není v dosahu/)).toBeInTheDocument();
  });

  // Nothing was applied on that path, so iOS raises no alert and there is
  // nothing to pre-empt — the note would be describing a message that will
  // never arrive.
  it('leaves the note off when the network was already configured', () => {
    onPhone({ status: 'done', outcome: 'already-configured' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/už na tomto zařízení nastavený je/)).toBeInTheDocument();
    expect(screen.queryByText(/není v dosahu/)).not.toBeInTheDocument();
  });

  it('reads an already-configured network as success, not a problem', () => {
    onPhone({ status: 'done', outcome: 'already-configured' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/už na tomto zařízení nastavený je/)).toBeInTheDocument();
  });

  it('does not scold a student who dismissed the system dialog', () => {
    onPhone({ status: 'idle', outcome: 'cancelled' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/Klepni znovu/)).toBeInTheDocument();
    expect(screen.queryByText('Profil se nepodařilo připravit')).not.toBeInTheDocument();
    expect(screen.getByText('Nastavit eduroam')).toBeInTheDocument();
  });

  it('never blames a profile on the native path, whatever failed', () => {
    // A throw before Android is even reached — a lapsed IS session, a network
    // blip fetching the certificate — leaves outcome null. The generic copy
    // ("couldn't prepare the profile") describes a step this path never takes.
    onPhone({ status: 'error', outcome: null, error: 'Failed to fetch' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.queryByText(/Profil se nepodařilo připravit/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nastavení eduroamu se nepodařilo/)).toBeInTheDocument();
  });

  it('names the real failure when the OS refuses the network', () => {
    // "Couldn't prepare the profile" is the wrong sentence here: no profile is
    // involved, and nothing was downloaded.
    onPhone({ status: 'error', outcome: 'failed' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.getByText(/Zařízení síť eduroam neuložilo/)).toBeInTheDocument();
  });

  it('takes the target from Capacitor, not the user agent — a WKWebView calling itself Macintosh is still iOS', () => {
    // The UA guess would read this device as a desktop Mac and hand it a blob
    // download the WebView does nothing useful with (#212).
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(true);
    mockedNativeTarget.mockReturnValue('ios');
    mockedCanConfigureNatively.mockReturnValue(true);
    mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), target: 'ios' });
    useAppStore.setState({ language: 'cz' } as never);

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(mockedUseEduroamSetup).toHaveBeenCalledWith('ios');
  });

  it('tells iOS students that eduroam lives as long as reIS does, and Android students nothing of the sort', () => {
    // NEHotspotConfiguration networks are removed with the app; Android's
    // saved network is the student's own and survives. Say so only where true.
    onPhone({}, 'ios');
    render(<EduroamSheet onClose={vi.fn()} />);
    expect(screen.getByText(/dokud máte reIS nainstalovaný/)).toBeInTheDocument();
    cleanup();

    onPhone({}, 'android');
    render(<EduroamSheet onClose={vi.fn()} />);
    expect(screen.queryByText(/dokud máte reIS nainstalovaný/)).not.toBeInTheDocument();
  });

  it('never renders a QR on the phone being configured', () => {
    // A desktop→phone artifact; on this device it points at itself.
    onPhone({ status: 'done', outcome: 'saved' });

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(screen.queryByAltText('eduroam QR')).not.toBeInTheDocument();
  });

  it('closes via the header close button', () => {
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(false);
    mockedUseEduroamSetup.mockReturnValue(baseHookState());
    useAppStore.setState({ language: 'cz' } as never);

    const onClose = vi.fn();
    render(<EduroamSheet onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Zavřít'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
