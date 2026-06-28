import type { Society } from '../types/events';
import { logError } from '../utils/reportError';

// Static catalog of the student societies that author campus-map events. Ids +
// logos reuse the existing spolky system (src/services/spolky/config.ts, logos
// shipped at public/spolky/<id>.jpg). Brand colours: ESN cyan, SU PEF the PEF
// blue, AU FRRMS the FRRMS magenta. Each maps to a faculty so the map's "My
// faculty" filter can include/exclude it (ESN is MENDELU-wide → always shown).
export const SOCIETIES: Record<string, Society> = {
  esn: { id: 'esn', name: 'ESN MENDELU', shortName: 'ESN', color: '#00AEEF', glyph: '✷', logo: '/spolky/esn.jpg', facultyKey: 'mendelu' },
  supef: { id: 'supef', name: 'SU PEF', shortName: 'SUPEF', color: '#0046a0', glyph: 'SU', logo: '/spolky/supef.jpg', facultyKey: 'pef' },
  au_frrms: { id: 'au_frrms', name: 'AU FRRMS', shortName: 'AU FRRMS', color: '#c32897', glyph: 'AU', logo: '/spolky/au_frrms.jpg', facultyKey: 'frrms' },
};

export const ALL_SOCIETIES: Society[] = Object.values(SOCIETIES);

// Unknown ids fall back to ESN so the UI never crashes on a bad event, but we
// log it — a missing catalog entry is bad data, not something to swallow silently.
export function societyById(id: string): Society {
  const society = SOCIETIES[id];
  if (society) return society;
  logError('societies.societyById', new Error(`unknown society id "${id}" — falling back to ESN`));
  return SOCIETIES.esn;
}
