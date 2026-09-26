import type { Society } from '../types/events';

// The catalog a first-ever launch starts from, before the societies table
// (supabase/migrations/20260926120000_societies_catalog.sql) has been fetched.
// It must match that migration's seed rows. After the first fetch the cached
// catalog replaces it, so editing a society here changes nothing for students:
// edit it in the admin console instead.
//
// No logos on purpose: logo URLs are content-hashed storage paths that exist
// only once scripts/seed-society-logos.ts has run against prod. Until the first
// fetch the glyph tile shows, which is what every logo slot falls back to.
const seed = (s: Omit<Society, 'isActive'>): Society => ({ ...s, isActive: true });

export const BUNDLED_SOCIETIES: Record<string, Society> = {
  esn: seed({
    id: 'esn',
    name: 'ESN MENDELU',
    shortName: 'ESN',
    color: '#00AEEF',
    glyph: 'ESN',
    facultyKey: 'mendelu',
    autoFollowFaculty: false,
    audienceLabel: 'erasmus',
    sortOrder: 10,
  }),
  supef: seed({
    id: 'supef',
    name: 'SU PEF',
    shortName: 'SUPEF',
    color: '#0046a0',
    glyph: 'SU',
    facultyKey: 'pef',
    autoFollowFaculty: true,
    audienceLabel: null,
    sortOrder: 20,
  }),
  au_frrms: seed({
    id: 'au_frrms',
    name: 'AU FRRMS',
    shortName: 'AU FRRMS',
    color: '#c32897',
    glyph: 'AU',
    facultyKey: 'frrms',
    autoFollowFaculty: true,
    audienceLabel: null,
    sortOrder: 30,
  }),
  usaf: seed({
    id: 'usaf',
    name: 'USAF',
    shortName: 'USAF',
    color: '#c87800',
    glyph: 'USAF',
    facultyKey: 'af',
    autoFollowFaculty: true,
    audienceLabel: null,
    sortOrder: 40,
  }),
  ldf: seed({
    id: 'ldf',
    name: 'LDF Spolek',
    shortName: 'LDF',
    color: '#0a5028',
    glyph: 'LDF',
    facultyKey: 'ldf',
    autoFollowFaculty: true,
    audienceLabel: null,
    sortOrder: 50,
  }),
  zf: seed({
    id: 'zf',
    name: 'ZF Spolek',
    shortName: 'ZF',
    color: '#8c0a00',
    glyph: 'ZF',
    facultyKey: 'zf',
    autoFollowFaculty: true,
    audienceLabel: null,
    sortOrder: 60,
  }),
  ey: seed({
    id: 'ey',
    name: 'EY',
    shortName: 'EY',
    color: '#2E2E38',
    glyph: 'EY',
    facultyKey: 'pef',
    autoFollowFaculty: false,
    audienceLabel: null,
    sortOrder: 70,
  }),
  reis: seed({
    id: 'reis',
    name: 'reIS',
    shortName: 'reIS',
    color: '#79be15',
    glyph: 'reIS',
    facultyKey: 'mendelu',
    autoFollowFaculty: false,
    audienceLabel: null,
    sortOrder: 80,
  }),
};
