import { describe, it, expect, vi, beforeEach } from 'vitest';

const upload = vi.fn();
const remove = vi.fn();
const single = vi.fn();
vi.mock('../../services/admin/authClient', () => ({
  adminAuthClient: {
    storage: { from: () => ({ upload, remove }) },
    from: () => ({
      insert: () => ({ select: () => ({ single }) }),
      update: () => ({ eq: () => ({ select: () => ({ single }) }) }),
    }),
  },
}));
vi.mock('../../utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { logoObjectPath, uploadSocietyLogo, insertSociety } from '../societiesAdmin';

const png = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

beforeEach(() => {
  upload.mockReset();
  single.mockReset();
});

describe('logoObjectPath', () => {
  it('is <id>/<32 hex>.png, the shape the database check accepts', async () => {
    expect(await logoObjectPath('kino', png)).toMatch(/^kino\/[0-9a-f]{32}\.png$/);
  });
  it('is stable for the same bytes and different for different bytes', async () => {
    const other = new Blob([new Uint8Array([9])], { type: 'image/png' });
    expect(await logoObjectPath('kino', png)).toBe(await logoObjectPath('kino', png));
    expect(await logoObjectPath('kino', png)).not.toBe(await logoObjectPath('kino', other));
  });
});

describe('uploadSocietyLogo', () => {
  it('returns the path on success', async () => {
    upload.mockResolvedValue({ error: null });
    expect(await uploadSocietyLogo('kino', png)).toMatch(/^kino\//);
    expect(upload.mock.calls[0]![2]).toMatchObject({ contentType: 'image/png', upsert: false });
  });
  it('treats "already exists" as success: same bytes, same path', async () => {
    upload.mockResolvedValue({ error: { message: 'The resource already exists' } });
    expect(await uploadSocietyLogo('kino', png)).toMatch(/^kino\//);
  });
  it('returns null on any other error', async () => {
    upload.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } });
    expect(await uploadSocietyLogo('kino', png)).toBeNull();
  });
});

describe('insertSociety', () => {
  it('maps the saved row back to a Society', async () => {
    single.mockResolvedValue({
      data: {
        id: 'kino',
        name: 'Kino',
        short_name: 'KINO',
        color: '#123456',
        faculty_key: 'zf',
        auto_follow_faculty: false,
        audience_label: null,
        logo_path: 'kino/aa.png',
        sort_order: 90,
        is_active: true,
      },
      error: null,
    });
    const s = await insertSociety(
      {
        id: 'kino',
        name: 'Kino',
        shortName: 'KINO',
        color: '#123456',
        facultyKey: 'zf',
        autoFollowFaculty: false,
      },
      'kino/aa.png',
      90
    );
    expect(s?.shortName).toBe('KINO');
  });
  it('returns null on error', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'duplicate key' } });
    expect(
      await insertSociety(
        {
          id: 'esn',
          name: 'x',
          shortName: 'x',
          color: '#123456',
          facultyKey: 'zf',
          autoFollowFaculty: false,
        },
        'esn/aa.png',
        1
      )
    ).toBeNull();
  });
});
