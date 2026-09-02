import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WelcomeWifiCard } from '../WelcomeWifiCard';

afterEach(cleanup);

type Props = Parameters<typeof WelcomeWifiCard>[0];

function renderCard(over: Partial<Props> = {}) {
  return render(
    <WelcomeWifiCard
      status="idle"
      outcome={null}
      target="ios"
      onSetup={vi.fn()}
      {...over}
    />
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

    it('names the one action that unblocks it', () => {
      renderCard({ status: 'error', outcome: 'stale-association' });

      expect(screen.getByText(/Zapomenout tuto síť/)).toBeInTheDocument();
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
