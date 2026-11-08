import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { SocietyPinCard } from '../SocietyPinCard';
import { MapPanelBody } from '../../mobile/screens/map/MapPanelBody';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { VENUE_PINS } from '../../../data/map/venues';
import type { MapEvent } from '../../../types/events';

const sklub = VENUE_PINS.find((p) => p.id === 'venue:sklub')!;

const event = (over: Partial<MapEvent>): MapEvent =>
  ({
    id: 'e1',
    societyId: 'sklub',
    title: 'Halloween ve Sklubu',
    date: '2026-11-20',
    time: '19:00',
    coord: [16.614393, 49.218171],
    roomCode: null,
    venueKind: 'offcampus',
    category: 'party',
    location: 'S-klub',
    ...over,
  }) as MapEvent;

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    // Mon 9 Nov 2026, 13:30 in Prague.
    now: new Date('2026-11-09T12:30:00Z'),
    societies: {
      ...BUNDLED_SOCIETIES,
      sklub: { ...BUNDLED_SOCIETIES.reis!, id: 'sklub', name: 'S-klub Pixie', shortName: 'S-klub' },
    },
    mapEvents: [
      event({}),
      event({ id: 'e2', societyId: 'esn', title: 'Not S-klub' }),
      event({ id: 'e3', title: 'Already over', date: '2026-11-01' }),
    ],
  } as never);
});
afterEach(cleanup);

// Task List #3: S-klub in reIS as the PDF mockup drew it — hours, lunch, the
// drinks menu by category, its events, on the phone, the iPad and the extension.
describe('S-klub venue card', () => {
  it('says it is open now, and until when', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Otevřeno do 18:00')).toBeTruthy();
    expect(screen.getByText(/Kavárna · Budova Z \(FRRMS\), přízemí/)).toBeTruthy();
  });

  it('says when it opens next when it is closed', () => {
    // Sat 14 Nov 2026, 12:00 in Prague.
    useAppStore.setState({ now: new Date('2026-11-14T11:00:00Z') } as never);
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText(/^Zavřeno · otevírá v pondělí v 8:00$/)).toBeTruthy();
  });

  it('shows the lunch offer with its price', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Denní menu s polévkou')).toBeTruthy();
    expect(screen.getByText('189 Kč')).toBeTruthy();
  });

  it('opens one menu category at a time, with prices', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.queryByText('Mango Fever')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limonády' }));
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('Mango Fever')).toBeTruthy();
    expect(within(list).getAllByText('89 Kč')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Káva' }));
    expect(screen.queryByText('Mango Fever')).toBeNull();
    expect(screen.getByText('Flat White')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Káva' }));
    expect(screen.queryByRole('list')).toBeNull();
  });

  it("lists S-klub's own upcoming events only", () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Halloween ve Sklubu')).toBeTruthy();
    expect(screen.queryByText('Not S-klub')).toBeNull();
    expect(screen.queryByText('Already over')).toBeNull();
  });

  it('says where the prices come from and when they were checked', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText(/Ceny podle sklubpixie\.cz, ověřeno 8\. 11\. 2026\./)).toBeTruthy();
  });

  it('is what the phone and iPad panel shows when the pin is tapped', () => {
    render(<MapPanelBody selectedEvent={null} selectedSocietyPin={sklub} />);
    expect(screen.getByTestId('venue-details')).toBeTruthy();
  });
});
