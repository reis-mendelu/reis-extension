import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MenuSheet } from '../MenuSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { venueRowToPin } from '../../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../../test/fixtures/sklubVenueRow';
import type { OutletMenu } from '../../../../types/menuTypes';

const DAY = '2026-11-09'; // a Monday
const MENU: OutletMenu[] = ['X', 'KA', 'JAK'].map((outlet) => ({
  outlet,
  days: [{ date: '9. 11. 2026', soup: null, mainDishes: [`Jídlo ${outlet}`] }],
}));
const SKLUB = venueRowToPin(SKLUB_VENUE_ROW)!;
// 10:00 in Prague on that Monday.
const NOW = new Date('2026-11-09T09:00:00Z');

const tabs = () =>
  within(screen.getByRole('group', { name: 'Výdejna' }))
    .getAllByRole('button')
    .map((b) => b.textContent);

/**
 * The S-klub tab in the phone/iPad Jídelníček — mockup "reIS venues S-klub
 * Pixie", page 4. Every student; second for FRRMS, last for everyone else
 * (Dominik, 1 and 11 November 2026).
 */
describe('MenuSheet — S-klub', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      menu: MENU,
      now: NOW,
      userFaculty: 'FRRMS',
      venuePins: [SKLUB],
      sklubMenu: [],
    } as never);
  });

  it('FRRMS sees KA, S-klub, X, JAK', () => {
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    expect(tabs()).toEqual(['KA', 'S-klub', 'X', 'JAK']);
  });

  it('everyone else sees X, JAK, KA, then S-klub', () => {
    useAppStore.setState({ userFaculty: 'PEF' } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    expect(tabs()).toEqual(['X', 'JAK', 'KA', 'S-klub']);
  });

  it('shows the lunch offer, the place and whether it is open', () => {
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    const panel = screen.getByTestId('menu-venue');
    expect(within(panel).getByText('Denní menu s polévkou')).toBeInTheDocument();
    expect(within(panel).getByText('189 Kč')).toBeInTheDocument();
    expect(within(panel).getByText('Budova Z, přízemí')).toBeInTheDocument();
    expect(within(panel).getByText('Otevřeno')).toBeInTheDocument();
    expect(within(panel).getByText(/Po–Pá 8:00–18:00/)).toBeInTheDocument();
  });

  it('lists the day’s soup and dishes when reIS has the week', () => {
    const pin = {
      ...SKLUB,
      venue: {
        ...SKLUB.venue!,
        lunchDays: [{ date: DAY, soup: 'Dýňová', dishes: ['Kuře na paprice'] }],
      },
    };
    useAppStore.setState({ venuePins: [pin] } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    const panel = screen.getByTestId('menu-venue');
    expect(within(panel).getByText('Kuře na paprice')).toBeInTheDocument();
    expect(within(panel).getByText(/Dýňová/)).toBeInTheDocument();
  });

  it('lists the week scraped from sklubpixie.cz, that day only', () => {
    useAppStore.setState({
      sklubMenu: [
        { date: '2026-11-06', soup: 'Česnečka', dishes: ['Minulý pátek'] },
        { date: DAY, soup: 'Bramboračka', dishes: ['140g Smažené kuřecí stehno'] },
      ],
    } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    const panel = screen.getByTestId('menu-venue');
    expect(within(panel).getByText('140g Smažené kuřecí stehno')).toBeInTheDocument();
    expect(within(panel).getByText(/Bramboračka/)).toBeInTheDocument();
    expect(within(panel).queryByText('Minulý pátek')).toBeNull();
  });

  it('shows the day’s dishes even without a fixed lunch offer', () => {
    const pin = { ...SKLUB, venue: { ...SKLUB.venue!, lunch: null } };
    useAppStore.setState({
      venuePins: [pin],
      sklubMenu: [{ date: DAY, soup: null, dishes: ['150g Kuře'] }],
    } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    expect(within(screen.getByTestId('menu-venue')).getByText('150g Kuře')).toBeInTheDocument();
  });

  it('"Celé menu a ceny" opens the venue on the map', () => {
    const focusSocietyPin = vi.fn();
    const setMobileTab = vi.fn();
    useAppStore.setState({ focusSocietyPin, setMobileTab } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    fireEvent.click(screen.getByRole('button', { name: /Celé menu a ceny/ }));
    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusSocietyPin).toHaveBeenCalledWith(SKLUB);
  });

  // Dominik, 11 November 2026: students on the main campus don't know where
  // budova Z is, so the place itself shows it on the map.
  it('tapping the place ("Budova Z, přízemí") shows the venue on the map', () => {
    const focusSocietyPin = vi.fn();
    const setMobileTab = vi.fn();
    useAppStore.setState({ focusSocietyPin, setMobileTab } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    fireEvent.click(screen.getByRole('button', { name: /Budova Z, přízemí.*Ukázat na mapě/ }));
    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusSocietyPin).toHaveBeenCalledWith(SKLUB);
  });
});
