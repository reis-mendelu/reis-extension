import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { from: () => ({ select: () => ({ order }) }) },
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import {
  rowToSociety,
  fetchSocieties,
  logoPublicUrl,
  SOCIETY_COLUMNS,
  type SocietyRow,
} from '../societies';

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
  instagram: null,
  kind: 'society',
  audience: null,
  mark_light_path: null,
  mark_dark_path: null,
};

beforeEach(() => order.mockReset());

describe('rowToSociety: partner columns', () => {
  const kpmg: SocietyRow = {
    ...row,
    id: 'kpmg',
    name: 'KPMG',
    short_name: 'KPMG',
    faculty_key: 'frrms',
    auto_follow_faculty: false,
    logo_path: null,
    kind: 'partner',
    audience: ['frrms'],
    mark_light_path: 'kpmg/0123456789abcdef0123456789abcdef.png',
    mark_dark_path: null,
  };
  it('maps kind, audience and marks', () => {
    const s = rowToSociety(kpmg)!;
    expect(s.kind).toBe('partner');
    expect(s.audience).toEqual(['frrms']);
    expect(s.markLight).toBe(logoPublicUrl('kpmg/0123456789abcdef0123456789abcdef.png'));
    expect(s.markDark).toBeUndefined();
  });
  it('reads an unknown kind as a society', () => {
    expect(rowToSociety({ ...kpmg, kind: 'sponsor' })!.kind).toBe('society');
  });
});

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
      kind: 'society',
      audience: null,
    });
  });
  it('leaves logo undefined when there is no path', () => {
    expect(rowToSociety({ ...row, logo_path: null })!.logo).toBeUndefined();
  });
  it('drops a row whose faculty the client does not know', () => {
    expect(rowToSociety({ ...row, faculty_key: 'xyz' })).toBeNull();
  });
  it('carries the Instagram handle when set', () => {
    expect(rowToSociety({ ...row, instagram: 'esnmendelubrno' })!.instagram).toBe('esnmendelubrno');
  });
  // Present-but-undefined, not absent: the store merges a saved row over the
  // cached one (`{ ...previous, ...saved }`), and an absent key kept the old
  // handle there, so a cleared handle came back the next time the form opened.
  it('carries an explicit undefined instagram when the row has none, so a merge clears it', () => {
    const s = rowToSociety({ ...row, instagram: null })!;
    expect(Object.prototype.hasOwnProperty.call(s, 'instagram')).toBe(true);
    expect(s.instagram).toBeUndefined();
  });
});

describe('SOCIETY_COLUMNS', () => {
  it('includes instagram', () => {
    expect(SOCIETY_COLUMNS).toContain('instagram');
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
