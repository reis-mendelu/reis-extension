import { describe, it, expect, vi } from 'vitest';
import { fetchSocietyPins } from '../mapEvents';
import { supabase } from '../../services/spolky/supabaseClient';

vi.mock('../../services/spolky/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const answer = (data: unknown, error: unknown = null) =>
  vi.mocked(supabase.from).mockReturnValueOnce({
    select: async () => ({ data, error }),
  } as never);

describe('fetchSocietyPins', () => {
  it('reads map_pins into pins: [lng, lat], trimmed text, only an https link', async () => {
    answer([
      {
        id: 'p1',
        association_id: 'vazbic',
        title: 'Vazbič',
        body: '  Knihařský spolek.  ',
        url: 'https://vazbic.example',
        coord_lng: 16.61,
        coord_lat: 49.21,
      },
      {
        id: 'p2',
        association_id: 'x',
        title: 'X',
        body: '',
        url: 'javascript:alert(1)',
        coord_lng: 16.6,
        coord_lat: 49.2,
      },
    ]);
    expect(await fetchSocietyPins()).toEqual([
      {
        id: 'p1',
        societyId: 'vazbic',
        title: 'Vazbič',
        description: 'Knihařský spolek.',
        url: 'https://vazbic.example',
        coord: [16.61, 49.21],
      },
      { id: 'p2', societyId: 'x', title: 'X', description: null, url: null, coord: [16.6, 49.2] },
    ]);
    expect(supabase.from).toHaveBeenCalledWith('map_pins');
  });

  // Before the release creates the table the read fails; that must read as
  // "not known", so the map keeps what it had (no pins), not as an error state.
  it('answers null, not [], when the read fails', async () => {
    answer(null, { message: 'relation "map_pins" does not exist' });
    expect(await fetchSocietyPins()).toBeNull();
  });
});
