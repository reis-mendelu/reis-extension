import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

  it('offers a new certificate when the current one has expired', () => {
    const onSetup = vi.fn();
    renderCard({ status: 'expired', expiredAt: new Date('2025-01-01T12:00:00Z'), onSetup });

    expect(screen.getByText(/vypršel 01\.01\.2025/)).toBeInTheDocument();
    expect(screen.queryByText(/Hotovo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Vygenerovat nový certifikát/ }));
    expect(onSetup).toHaveBeenCalledTimes(1);
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

  it('does not read a blocked renewal as done', () => {
    renderCard({ status: 'error', outcome: 'renewal-blocked' });

    expect(screen.queryByText(/Hotovo/)).not.toBeInTheDocument();
    expect(screen.getByText(/nový certifikát/i)).toBeInTheDocument();
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

  /**
   * Being off Wi‑Fi is fine — setup only needs internet, and mobile data is
   * enough. No connection at all is the case that needs saying, in words, not
   * as the generic "Nepovedlo se".
   */
  describe('without a network', () => {
    it('says the student is offline and that mobile data will do', () => {
      renderCard({ status: 'error', networkFailure: 'offline' });

      expect(screen.getByText(/Jsi offline/)).toHaveTextContent(/mobilní data/);
      expect(screen.queryByText(/Nepovedlo se/)).not.toBeInTheDocument();
    });

    it('hedges when the device thinks it is online but IS never answered', () => {
      renderCard({ status: 'error', networkFailure: 'unreachable' });

      expect(screen.getByText(/Nepodařilo se spojit s IS/)).toBeInTheDocument();
      expect(screen.queryByText(/Jsi offline/)).not.toBeInTheDocument();
    });
  });

  // Read before the tap, because after it iOS's own "Unable to join" alert
  // sits on top of whatever this card says.
  describe('the iOS join alert, named before the tap', () => {
    it('says setup works anywhere and the alert is expected', () => {
      renderCard({ status: 'idle', target: 'ios' });

      expect(screen.getByText(/Jde to odkudkoli s internetem/)).toHaveTextContent(/v pořádku/);
    });

    it('is not on Android, which never attempts a join', () => {
      renderCard({ status: 'idle', target: 'android' });

      expect(screen.queryByText(/Jde to odkudkoli/)).not.toBeInTheDocument();
    });

    it('gives way to the saved note once done', () => {
      renderCard({ status: 'done', outcome: 'saved', target: 'ios' });

      expect(screen.queryByText(/Jde to odkudkoli/)).not.toBeInTheDocument();
    });
  });
});
