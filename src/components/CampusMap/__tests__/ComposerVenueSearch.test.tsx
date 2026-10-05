import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerVenueSearch } from '../ComposerVenueSearch';
import type { PlaceResult } from '../../../api/placeSearch';

vi.mock('../../../api/placeSearch', () => ({ searchPlaces: vi.fn() }));
import { searchPlaces } from '../../../api/placeSearch';

const t = (k: string) => k;
const BAR: PlaceResult = {
  id: 'N42',
  name: 'Bar, který neexistuje',
  context: 'Brno, Dvořákova',
  coord: [16.6097, 49.1959],
};

const props = () => ({
  selected: null as string | null,
  onSelectRoom: vi.fn(),
  onSelectPlace: vi.fn(),
  onSelectPoint: vi.fn(),
  onClear: vi.fn(),
  onPickOnMap: vi.fn(),
  t,
});

const type = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('map.searchVenue'), { target: { value } });

// One box instead of "Kampus / Ve městě" plus a search per kind: a society
// types where the event is, and the kind follows from what it picks.
describe('ComposerVenueSearch', () => {
  beforeEach(() => {
    vi.mocked(searchPlaces).mockReset();
    vi.mocked(searchPlaces).mockResolvedValue([BAR]);
  });

  it('finds a campus room as you type and hands back its code and coordinate', () => {
    const p = props();
    render(<ComposerVenueSearch {...p} />);
    type('q01');
    const hit = screen.getAllByRole('button').find((b) => /^Q01/.test(b.textContent ?? ''));
    fireEvent.click(hit as HTMLElement);
    expect(p.onSelectRoom).toHaveBeenCalledTimes(1);
    const sel = p.onSelectRoom.mock.calls[0]![0];
    expect(sel.code).toBeTruthy();
    expect(sel.coord[0]).toBeGreaterThan(16);
  });

  it('finds a place in town in the same box, below the rooms', async () => {
    const p = props();
    render(<ComposerVenueSearch {...p} />);
    type('bar který neexistuje');
    const hit = await screen.findByText('Bar, který neexistuje');
    expect(searchPlaces).toHaveBeenCalledWith('bar který neexistuje');
    fireEvent.click(hit);
    expect(p.onSelectPlace).toHaveBeenCalledWith({
      name: 'Bar, který neexistuje',
      coord: [16.6097, 49.1959],
    });
  });

  it('lists campus rooms before places in town', async () => {
    render(<ComposerVenueSearch {...props()} />);
    type('q01');
    await screen.findByText('Bar, který neexistuje');
    const campus = screen.getByText('map.venueCampus');
    const city = screen.getByText('map.venueOffcampus');
    expect(campus.compareDocumentPosition(city) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not ask the place service about a single character', async () => {
    render(<ComposerVenueSearch {...props()} />);
    type('a');
    await new Promise((r) => setTimeout(r, 350));
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  // An organiser who already has the spot in Google Maps or Mapy.cz pastes it
  // instead of hunting for the pin by hand (task list, Sprint 11).
  it('turns pasted coordinates into a pin without asking the place service', async () => {
    const p = props();
    render(<ComposerVenueSearch {...p} />);
    type('49.2078989, 16.6030499');
    fireEvent.click(screen.getByRole('button', { name: /map.useThisPoint/ }));
    expect(p.onSelectPoint).toHaveBeenCalledWith([16.6030499, 49.2078989]);
    await new Promise((r) => setTimeout(r, 350));
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(screen.queryByText('map.noPlaceFound')).toBeNull();
  });

  it('keeps the place name a pasted Google Maps link carries', () => {
    const p = props();
    render(<ComposerVenueSearch {...p} />);
    type('https://www.google.com/maps/place/Padagali/@49.2078989,16.6030499,17z');
    fireEvent.click(screen.getByRole('button', { name: /Padagali/ }));
    expect(p.onSelectPlace).toHaveBeenCalledWith({
      name: 'Padagali',
      coord: [16.6030499, 49.2078989],
    });
    expect(p.onSelectPoint).not.toHaveBeenCalled();
  });

  it('says the place search is not answering, rather than that nothing exists', async () => {
    vi.mocked(searchPlaces).mockResolvedValue(null);
    render(<ComposerVenueSearch {...props()} />);
    type('Kotlářská 51a');
    expect(await screen.findByText('map.placeSearchFailed')).toBeInTheDocument();
    expect(screen.queryByText('map.noPlaceFound')).toBeNull();
  });

  it('still lists campus rooms when the place search fails', async () => {
    vi.mocked(searchPlaces).mockResolvedValue(null);
    render(<ComposerVenueSearch {...props()} />);
    type('q01');
    await screen.findByText('map.placeSearchFailed');
    expect(screen.getByText('map.venueCampus')).toBeInTheDocument();
  });

  it('always offers dropping the pin by hand', () => {
    const p = props();
    render(<ComposerVenueSearch {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /map.orPickOnMap/ }));
    expect(p.onPickOnMap).toHaveBeenCalledTimes(1);
  });

  it('shows the chosen venue with a way to change it', () => {
    const p = { ...props(), selected: 'Lužánky' };
    render(<ComposerVenueSearch {...p} />);
    expect(screen.getByText('Lužánky')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('map.searchVenue')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'map.changePlace' }));
    expect(p.onClear).toHaveBeenCalledOnce();
  });

  it('fills the composer like every other field', () => {
    const { container } = render(<ComposerVenueSearch {...props()} />);
    expect(container.querySelector('label.input')?.className).toContain('w-full');
  });
});
