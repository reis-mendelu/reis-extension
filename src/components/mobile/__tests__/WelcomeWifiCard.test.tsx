import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WelcomeWifiCard } from '../WelcomeWifiCard';

afterEach(cleanup);

type Props = Parameters<typeof WelcomeWifiCard>[0];

function renderCard(over: Partial<Props> = {}) {
  return render(
    <WelcomeWifiCard status="idle" outcome={null} target="ios" onSetup={vi.fn()} {...over} />
  );
}

describe('WelcomeWifiCard', () => {
  it('offers the setup while idle', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /Nastavit eduroam/ })).toBeInTheDocument();
    expect(screen.getByText(/Školní Wi-Fi jedním klepnutím/)).toBeInTheDocument();
  });

  it('reads as done once the network is saved, with no button left', () => {
    renderCard({ status: 'done', outcome: 'saved' });
    expect(screen.getByText(/Hotovo, na fakultě se připojíš sám/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /**
   * First run is the likeliest moment for this: a student installs reIS at
   * home, taps Nastavit eduroam, and iOS puts up its own "Unable to join the
   * network eduroam" alert over this very card. The sheet in Profil explains
   * it; this screen is where most students meet it first.
   */
  describe('the iOS join alert, on the screen that gets it first', () => {
    it('explains the alert once the network is saved', () => {
      renderCard({ status: 'done', outcome: 'saved', target: 'ios' });

      expect(screen.getByText(/není v dosahu/)).toBeInTheDocument();
    });

    // Android's `addNetworkSuggestions` only saves — it never attempts a join,
    // so no alert appears and the note would describe something that cannot
    // happen. Same gate as the iOS-lifetime note beside it.
    it('says nothing about it on Android', () => {
      renderCard({ status: 'done', outcome: 'saved', target: 'android' });

      expect(screen.queryByText(/není v dosahu/)).not.toBeInTheDocument();
    });

    // Nothing was applied, so iOS raises no alert.
    it('says nothing when the network was already configured', () => {
      renderCard({ status: 'done', outcome: 'already-configured', target: 'ios' });

      expect(screen.queryByText(/není v dosahu/)).not.toBeInTheDocument();
    });

    it('says nothing while the setup is still on offer', () => {
      renderCard({ status: 'idle', outcome: null, target: 'ios' });

      expect(screen.queryByText(/není v dosahu/)).not.toBeInTheDocument();
    });
  });

  describe('stale association (#261)', () => {
    /**
     * The regression this pins: iOS answers `alreadyAssociated` whenever the
     * device is on the SSID, configuration or not, and the app used to report
     * that as done. A student who reinstalled on campus was told eduroam was
     * set up while nothing had been installed.
     */
    it('does not read as done', () => {
      renderCard({ status: 'error', outcome: 'stale-association' });

      expect(screen.queryByText(/Hotovo/)).not.toBeInTheDocument();
      expect(screen.queryByText(/nastavený je/)).not.toBeInTheDocument();
    });

    it('does not claim reIS set anything up, because code 13 cannot tell', () => {
      renderCard({ status: 'error', outcome: 'stale-association' });

      // The association may be an orphan (our configuration was deleted) or
      // someone else's working profile — a university-managed one, a manual
      // join. `getConfiguredSSIDs` only reports what THIS app installed, so it
      // cannot separate them. The line must be true either way: state that we
      // cannot act now, and give the recovery step conditionally.
      expect(screen.getByText(/nastavit nejde/)).toBeInTheDocument();
      expect(screen.getByText(/Kdyby se později nepřipojil/)).toBeInTheDocument();
    });

    it('does not tell a student to tear down a network that may be working', () => {
      renderCard({ status: 'error', outcome: 'stale-association' });
      const line = screen.getByText(/nastavit nejde/).textContent ?? '';

      // "forget the network" is conditional on it failing later, never an
      // instruction to do now — for the student whose eduroam came from the
      // university's own profile, doing it now breaks a working network.
      expect(line).toMatch(/Kdyby.*zapomeň/s);
    });

    it('keeps the setup button so the retry is one tap away', () => {
      renderCard({ status: 'error', outcome: 'stale-association' });

      expect(screen.getByRole('button', { name: /Nastavit eduroam/ })).toBeInTheDocument();
    });

    it('is distinguishable from a plain failure', () => {
      renderCard({ status: 'error', outcome: 'failed' });
      const failure = screen.getByText(/Nepovedlo se/);

      expect(failure).toBeInTheDocument();
      expect(screen.queryByText(/Zapomenout tuto síť/)).not.toBeInTheDocument();
    });
  });
});
