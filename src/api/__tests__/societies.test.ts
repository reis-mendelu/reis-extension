import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { from: () => ({ select: () => ({ order }) }) },
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { rowToSociety, fetchSocieties, logoPublicUrl, type SocietyRow } from '../societies';

const row: SocietyRow = {
  id: 'supef',
  name: 'SU PEF',
  short_name: 'SUPEF',
  color: '#0046a0',
  faculty_key: 'pef',
  auto_follow_faculty: true,
  audience_label: null,
  logo_path: 'supef/0123456789abcdef0123456789abcdef.png',
  sort_order: 20,
  is_active: true,
};

beforeEach(() => order.mockReset());

describe('rowToSociety', () => {
  it('maps a row, building the public logo URL and the glyph', () => {
    expect(rowToSociety(row)).toEqual({
      id: 'supef',
      name: 'SU PEF',
      shortName: 'SUPEF',
      color: '#0046a0',
      glyph: 'SU',
      logo: logoPublicUrl('supef/0123456789abcdef0123456789abcdef.png'),
      facultyKey: 'pef',
      autoFollowFaculty: true,
      audienceLabel: null,
      sortOrder: 20,
      isActive: true,
    });
  });
  it('leaves logo undefined when there is no path', () => {
    expect(rowToSociety({ ...row, logo_path: null })!.logo).toBeUndefined();
  });
  it('drops a row whose faculty the client does not know', () => {
    expect(rowToSociety({ ...row, faculty_key: 'xyz' })).toBeNull();
  });
});

describe('logoPublicUrl', () => {
  it('points at the public object endpoint of the society-logos bucket', () => {
    expect(logoPublicUrl('esn/ab.png')).toMatch(
      /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/society-logos\/esn\/ab\.png$/
    );
  });
});

describe('fetchSocieties', () => {
  it('returns null on error so the caller keeps what it has', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchSocieties()).toBeNull();
  });
  it('maps and filters rows', async () => {
    order.mockResolvedValue({ data: [row, { ...row, id: 'bad', faculty_key: '??' }], error: null });
    expect((await fetchSocieties())!.map((s) => s.id)).toEqual(['supef']);
  });
});
