import type { Society } from '../types/events';
import { logError } from '../utils/reportError';

// Static catalog of the student societies that author campus-map events. Ids +
// logos reuse the existing spolky system (src/services/spolky/config.ts, logos
// shipped at public/spolky/<id>.jpg). Brand colours: ESN cyan, SU PEF the PEF
// blue, AU FRRMS the FRRMS magenta. Each maps to a faculty so the map's "My
// faculty" filter can include/exclude it (ESN is MENDELU-wide → always shown).
export const SOCIETIES: Record<string, Society> = {
  esn: {
    id: 'esn',
    name: 'ESN MENDELU',
    shortName: 'ESN',
    color: '#00AEEF',
    glyph: '✷',
    logo: '/spolky/esn.jpg',
    facultyKey: 'mendelu',
  },
  supef: {
    id: 'supef',
    name: 'SU PEF',
    shortName: 'SUPEF',
    color: '#0046a0',
    glyph: 'SU',
    logo: '/spolky/supef.jpg',
    facultyKey: 'pef',
  },
  au_frrms: {
    id: 'au_frrms',
    name: 'AU FRRMS',
    shortName: 'AU FRRMS',
    color: '#c32897',
    glyph: 'AU',
    logo: '/spolky/au_frrms.jpg',
    facultyKey: 'frrms',
  },
  af: {
    id: 'af',
    name: 'AF Spolek',
    shortName: 'AF',
    color: '#c87800',
    glyph: 'AF',
    logo: '/spolky/af.jpg',
    facultyKey: 'af',
  },
  ldf: {
    id: 'ldf',
    name: 'LDF Spolek',
    shortName: 'LDF',
    color: '#0a5028',
    glyph: 'LDF',
    logo: '/spolky/ldf.jpg',
    facultyKey: 'ldf',
  },
  zf: {
    id: 'zf',
    name: 'ZF Spolek',
    shortName: 'ZF',
    color: '#8c0a00',
    glyph: 'ZF',
    logo: '/spolky/zf.jpg',
    facultyKey: 'zf',
  },
  // EY: a partner company, not a faculty union, so campus-wide like ESN. Pin
  // colour is EY's navy rather than its yellow — the campus basemap is always
  // light, and #FFE600 on it is unreadable. Logo is SVG rather than JPG (see
  // public/spolky/ey.svg for provenance); `logo` is just a path, so the mix is
  // fine — reIS's own entry already points at an SVG.
  ey: {
    id: 'ey',
    name: 'EY',
    shortName: 'EY',
    color: '#2E2E38',
    glyph: 'EY',
    logo: '/spolky/ey.svg',
    facultyKey: 'mendelu',
  },
  // The reIS team itself (reis_admin role). Campus-wide like ESN. Uses the app's
  // own logo (served at the extension root, like /spolky/*).
  reis: {
    id: 'reis',
    name: 'reIS',
    shortName: 'reIS',
    color: '#79be15',
    glyph: 'reIS',
    logo: '/reIS_logo.svg',
    facultyKey: 'mendelu',
  },
};

export const ALL_SOCIETIES: Society[] = Object.values(SOCIETIES);

// Unknown ids fall back to ESN so the UI never crashes on a bad event, but we
// log it — a missing catalog entry is bad data, not something to swallow silently.
export function societyById(id: string): Society {
  const society = SOCIETIES[id];
  if (society) return society;
  logError('societies.societyById', new Error(`unknown society id "${id}" — falling back to ESN`));
  return SOCIETIES.esn!; // safe: 'esn' is a static catalog key defined above
}
