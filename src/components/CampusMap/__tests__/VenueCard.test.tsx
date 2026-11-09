import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { SocietyPinCard } from '../SocietyPinCard';
import { MapPanelBody } from '../../mobile/screens/map/MapPanelBody';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { venueRowToPin } from '../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../test/fixtures/sklubVenueRow';
import type { MapEvent } from '../../../types/events';
import type { VenueRow } from '../../../api/venues';

const wide = vi.hoisted(() => ({ value: false }));
vi.mock('../../../hooks/ui/useWideViewport', () => ({ useWideViewport: () => wide.value }));

const pinFrom = (over: Partial<VenueRow> = {}) => venueRowToPin({ ...SKLUB_VENUE_ROW, ...over })!;
const sklub = pinFrom();

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
  wide.value = false;
  useAppStore.setState({
    language: 'cz',
    // Mon 9 Nov 2026, 13:30 in Prague.
    now: new Date('2026-11-09T12:30:00Z'),
    venueMenuSection: null,
    sklubMenu: [],
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

// Task List #3, to the S-klub mockup PDF: one card on the phone, the iPad and
// the extension; width decides only how the menu opens.
describe('S-klub venue card', () => {
  it('names the venue, where it is, and that it is open until 18:00', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Kavárna · Budova Z')).toBeTruthy();
    expect(screen.getByText('Přízemí FRRMS · tř. Generála Píky 7')).toBeTruthy();
    expect(screen.getByTestId('venue-status').textContent).toBe('Otevřeno');
    expect(screen.getByText('dnes do 18:00 · Po–Pá 8:00–18:00')).toBeTruthy();
  });

  it('says when it opens next while closed', () => {
    // Sat 14 Nov 2026, 12:00 in Prague.
    useAppStore.setState({ now: new Date('2026-11-14T11:00:00Z') } as never);
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByTestId('venue-status').textContent).toBe('Zavřeno');
    expect(screen.getByText('otevírá v pondělí v 8:00 · Po–Pá 8:00–18:00')).toBeTruthy();
    expect(screen.getByText('K obědu')).toBeTruthy();
  });

  it('announces a closure, and when it opens again', () => {
    const closed = pinFrom({ closed_from: '2026-11-09', closed_until: '2026-11-13' });
    render(<SocietyPinCard pin={closed} />);
    const notice = screen.getByRole('status');
    expect(within(notice).getByText('Dočasně zavřeno')).toBeTruthy();
    expect(within(notice).getByText('9. 11.–13. 11. · znovu otevře 16. 11.')).toBeTruthy();
    expect(screen.getByTestId('venue-status').textContent).toBe('Zavřeno');
  });

  it('offers directions in a map app and Instagram', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByRole('link', { name: 'Trasa sem' }).getAttribute('href')).toContain(
      'google.com/maps'
    );
    expect(screen.getByRole('link', { name: 'Instagram' }).getAttribute('href')).toBe(
      'https://www.instagram.com/sklub_pixie/'
    );
  });

  it('shows the photos from the venue-photos bucket', () => {
    render(<SocietyPinCard pin={sklub} />);
    const imgs = within(screen.getByTestId('venue-photos')).getAllByRole('presentation');
    expect(imgs).toHaveLength(3);
    expect(imgs[0]!.getAttribute('src')).toMatch(
      /\/storage\/v1\/object\/public\/venue-photos\/sklub\//
    );
  });

  it("shows today's lunch offer, and the day's dishes once the week is filled in", () => {
    const { unmount } = render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Dnes k obědu')).toBeTruthy();
    expect(screen.getByText('Denní menu s polévkou')).toBeTruthy();
    expect(screen.getByText('189 Kč')).toBeTruthy();
    unmount();
    const week = pinFrom({
      lunch_week: {
        days: [{ date: '2026-11-09', soup: 'Dýňový krém', dishes: ['A) Kuřecí prsíčko'] }],
      },
    });
    render(<SocietyPinCard pin={week} />);
    expect(screen.getByText('Dýňový krém')).toBeTruthy();
    expect(screen.getByText('A) Kuřecí prsíčko')).toBeTruthy();
  });

  // Dominik, 9 Nov 2026: S-klub's menu is scraped on the device like SKM's,
  // and the card shows the same days as the Jídelníček's S-klub tab.
  it("prefers the week scraped from sklubpixie.cz over the table's", () => {
    useAppStore.setState({
      sklubMenu: [{ date: '2026-11-09', soup: 'Bramboračka', dishes: ['150g Kuřecí řízek'] }],
    } as never);
    const week = pinFrom({
      lunch_week: { days: [{ date: '2026-11-09', soup: 'Stará', dishes: ['Staré jídlo'] }] },
    });
    render(<SocietyPinCard pin={week} />);
    expect(screen.getByText('Bramboračka')).toBeTruthy();
    expect(screen.getByText('150g Kuřecí řízek')).toBeTruthy();
    expect(screen.queryByText('Staré jídlo')).toBeNull();
  });

  it('on a phone, opens a menu category as a page of its own, and back', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.queryByText('Mango Fever')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Limonády\s*89 Kč/ }));
    const page = screen.getByTestId('venue-menu-page');
    expect(within(page).getByText('S-klub Pixie · menu')).toBeTruthy();
    const items = within(page).getByTestId('venue-menu-items');
    expect(within(items).getAllByRole('listitem')).toHaveLength(3);
    expect(within(items).getAllByText('89 Kč')).toHaveLength(3);
    fireEvent.click(within(page).getByRole('button', { name: 'Káva' }));
    expect(screen.getByText('Flat White')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zpět na menu' }));
    expect(screen.getByTestId('venue-card')).toBeTruthy();
  });

  it('on a wide layout, lists the first category under chips, one at a time', () => {
    wide.value = true;
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Flat White')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limonády' }));
    expect(screen.queryByText('Flat White')).toBeNull();
    expect(screen.getByText('Mango Fever')).toBeTruthy();
  });

  it('shows the price range of each category on the phone grid', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByRole('button', { name: /Káva\s*35–65 Kč/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pivo\s*45–55 Kč/ })).toBeTruthy();
  });

  it("lists S-klub's own upcoming events only", () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Halloween ve Sklubu')).toBeTruthy();
    expect(screen.queryByText('Not S-klub')).toBeNull();
    expect(screen.queryByText('Already over')).toBeNull();
  });

  it('says where the prices come from and when they were checked', () => {
    render(<SocietyPinCard pin={sklub} />);
    expect(screen.getByText('Ceny podle sklubpixie.cz, ověřeno 8. 11. 2026.')).toBeTruthy();
  });

  it('is what the phone and iPad panel shows when the pin is tapped', () => {
    render(<MapPanelBody selectedEvent={null} selectedSocietyPin={sklub} />);
    expect(screen.getByTestId('venue-card')).toBeTruthy();
  });
});
