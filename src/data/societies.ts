import type { Society } from '../types/events';

// Static catalog of the student societies that author campus-map events. Ids +
// logos reuse the existing spolky system (src/services/spolky/config.ts, logos
// shipped at public/spolky/<id>.jpg). Brand colours: ESN cyan, SU PEF the PEF
// blue, AU FRRMS the FRRMS magenta. Each maps to a faculty so the map's "My
// faculty" filter can include/exclude it (ESN is MENDELU-wide → always shown).
export const SOCIETIES: Record<string, Society> = {
  esn: { id: 'esn', name: 'ESN MENDELU', color: '#00AEEF', glyph: '✷', logo: '/spolky/esn.jpg', facultyKey: 'mendelu' },
  supef: { id: 'supef', name: 'SU PEF', color: '#0046a0', glyph: 'SU', logo: '/spolky/supef.jpg', facultyKey: 'pef' },
  au_frrms: { id: 'au_frrms', name: 'AU FRRMS', color: '#c32897', glyph: 'AU', logo: '/spolky/au_frrms.jpg', facultyKey: 'frrms' },
};

export const ALL_SOCIETIES: Society[] = Object.values(SOCIETIES);

export function societyById(id: string): Society {
  return SOCIETIES[id] ?? SOCIETIES.esn;
}
