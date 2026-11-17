import { describe, it, expect, vi } from 'vitest';
import { fetchVenuePins, venuePhotoUrl, venueRowToPin } from '../venues';
import { supabase } from '../../services/spolky/supabaseClient';
import { SKLUB_VENUE_ROW } from '../../test/fixtures/sklubVenueRow';

vi.mock('../../services/spolky/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const answer = (data: unknown, error: unknown = null) =>
  vi.mocked(supabase.from).mockReturnValueOnce({
    select: () => ({ order: async () => ({ data, error }) }),
  } as never);

describe('venueRowToPin', () => {
  it("reads S-klub's row into a pin with its venue", () => {
    const pin = venueRowToPin(SKLUB_VENUE_ROW)!;
    expect(pin.id).toBe('venue:sklub');
    expect(pin.coord).toEqual([16.614393, 49.218171]);
    expect(pin.venue!.hours).toHaveLength(5);
    expect(pin.venue!.menu.map((m) => m.id)).toEqual([
      'coffee',
      'matcha',
      'bubble',
      'lemonade',
      'soft',
      'beer',
      'cocktails',
      'shots',
      'prosecco',
    ]);
    expect(pin.venue!.roomCode).toBe('BZ00N1015');
    expect(pin.venue!.source).toEqual({ url: 'https://sklubpixie.cz/', checked: '2026-11-08' });
  });

  it('drops a row it cannot name or place', () => {
    expect(venueRowToPin({ ...SKLUB_VENUE_ROW, kind: null })).toBeNull();
    expect(venueRowToPin({ ...SKLUB_VENUE_ROW, title: ' ' })).toBeNull();
  });

  it('empties only the part of the card a bad field belongs to', () => {
    const pin = venueRowToPin({
      ...SKLUB_VENUE_ROW,
      hours: [
        { day: 9, open: '08:00', close: '18:00' },
        { day: 1, open: '18:00', close: '08:00' },
      ],
      menu: 'nope',
      lunch: { name: { cz: 'X' } },
    })!;
    expect(pin.venue!.hours).toEqual([]);
    expect(pin.venue!.menu).toEqual([]);
    expect(pin.venue!.lunch).toBeNull();
  });

  it('keeps only a dated closure whose both ends are dates', () => {
    expect(
      venueRowToPin({ ...SKLUB_VENUE_ROW, closed_from: '2026-11-09', closed_until: null })!.venue!
        .closure
    ).toBeNull();
    expect(
      venueRowToPin({ ...SKLUB_VENUE_ROW, closed_from: '2026-11-09', closed_until: '2026-11-13' })!
        .venue!.closure
    ).toEqual({ from: '2026-11-09', until: '2026-11-13' });
  });
});

// Photos load from Supabase Storage only: a full URL would load an image from a
// host reIS does not disclose.
describe('venuePhotoUrl', () => {
  it('turns a bucket path into its public URL', () => {
    expect(venuePhotoUrl('sklub/kava.jpg')).toMatch(
      /^https:\/\/\w+\.supabase\.co\/storage\/v1\/object\/public\/venue-photos\/sklub\/kava\.jpg$/
    );
  });

  it('refuses a full URL or a path that climbs out', () => {
    expect(venuePhotoUrl('https://evil.example/x.jpg')).toBeNull();
    expect(venuePhotoUrl('sklub/../x.jpg')).toBeNull();
    expect(venuePhotoUrl(null)).toBeNull();
  });
});

describe('fetchVenuePins', () => {
  it('reads the venues table', async () => {
    answer([SKLUB_VENUE_ROW]);
    const pins = await fetchVenuePins();
    expect(supabase.from).toHaveBeenCalledWith('venues');
    expect(pins).toHaveLength(1);
  });

  it('is null when the table is not there yet, so the slice keeps what it had', async () => {
    answer(null, { message: 'relation "public.venues" does not exist' });
    expect(await fetchVenuePins()).toBeNull();
  });
});
