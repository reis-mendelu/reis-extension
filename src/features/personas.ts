import {
  ImpersonationError,
  type FacultyOptions,
  type ImpersonationSelection,
  type ProgrammeOption,
} from '../api/impersonation/types';
import { EXCHANGE_PROGRAMME } from '../utils/eventAudience';

export type PersonaId = 'it' | 'finance' | 'economics' | 'frrms' | 'af' | 'ldf' | 'zf' | 'erasmus';

/**
 * One fixed "view as" student for reIS admins (design 2026-11-27 §1). A constant
 * in code: no Supabase row, no migration, no disclosure (decision #8).
 */
export interface Persona {
  id: PersonaId;
  label: { cz: string; en: string };
  faculty: 'PEF' | 'FRRMS' | 'AF' | 'LDF' | 'ZF';
  /**
   * Matched against `loadOptions()` by shortCode at use, never stored as an IS
   * id: ids change with every accreditation. Null for Erasmus: an exchange
   * student is IS programme Z-EXC, which has no plan to resolve.
   */
  shortCode: string | null;
  year: 1;
  /**
   * Erasmus only: the pinned English-taught course codes, resolved by code
   * against the faculty's timetable course select at use.
   */
  erasmus?: { courses: string[] };
  /** Erasmus only: the UI language while the persona is active, in memory only. */
  language?: 'en';
}

/**
 * Decision #1: seven programme personas and Erasmus, all first year. B-OI
 * stays although Dominik studies it: Tonda (B-F) uses it.
 */
export const PERSONAS: readonly Persona[] = [
  { id: 'it', label: { cz: 'IT', en: 'IT' }, faculty: 'PEF', shortCode: 'B-OI', year: 1 },
  {
    id: 'finance',
    label: { cz: 'Finance', en: 'Finance' },
    faculty: 'PEF',
    shortCode: 'B-F',
    year: 1,
  },
  {
    id: 'economics',
    label: { cz: 'Ekonomika', en: 'Economics' },
    faculty: 'PEF',
    shortCode: 'B-EM',
    year: 1,
  },
  {
    id: 'frrms',
    label: { cz: 'Teritoriální studia', en: 'Territorial studies' },
    faculty: 'FRRMS',
    shortCode: 'B-METS',
    year: 1,
  },
  {
    id: 'af',
    label: { cz: 'Zemědělství', en: 'Agriculture' },
    faculty: 'AF',
    shortCode: 'B-ZIN',
    year: 1,
  },
  {
    id: 'ldf',
    label: { cz: 'Dřevostavby', en: 'Timber building' },
    faculty: 'LDF',
    shortCode: 'B-SNBD',
    year: 1,
  },
  {
    id: 'zf',
    label: { cz: 'Správa zeleně', en: 'Green spaces' },
    faculty: 'ZF',
    shortCode: 'B-RASZ',
    year: 1,
  },
  {
    // Decision #5: PEF has the most exchange installs (43 of ≈130). Five
    // English-taught bachelor courses with a lecture and a seminar this term
    // whose slots do not collide (picked from PEF's timetable, 2026-11-28).
    id: 'erasmus',
    label: { cz: 'Erasmus', en: 'Erasmus' },
    faculty: 'PEF',
    shortCode: null,
    year: 1,
    erasmus: { courses: ['EBA-MAR', 'EBA-MI', 'EBA-MT', 'EBA-PE', 'EBA-FT'] },
    language: 'en',
  },
];

export const personaById = (id: string | undefined): Persona | undefined =>
  PERSONAS.find((p) => p.id === id);

/** How the list and the banner name it: "IT · B-OI", Erasmus by its faculty. */
export const personaName = (p: Persona, language: 'cz' | 'en'): string =>
  `${p.label[language]} · ${p.shortCode ?? p.faculty}`;

/**
 * The picker entry a persona stands for. Through the variants, not only the
 * top-level code: `mergeVersions` keeps the first IS version's code at the top,
 * so ZF's entry can read B-RSZ while the persona asks for B-RASZ.
 */
export function resolvePersona(p: Persona, options: FacultyOptions[]): ProgrammeOption | null {
  const code = p.shortCode;
  if (!code) return null;
  const programmes = options.find((f) => f.faculty === p.faculty)?.programmes ?? [];
  return (
    programmes.find((x) => x.shortCode === code || x.variants.some((v) => v.shortCode === code)) ??
    null
  );
}

/**
 * What the persona asks IS for: the resolved programme, and decision #10's
 * group, the FIRST one IS lists. A literal 1 is wrong where groups are
 * numbered otherwise, and a group that does not exist silently returns
 * lectures only. Shared with `npm run personas:check`, so the check runs
 * exactly what the app does.
 */
export async function personaRequest(
  p: Persona,
  options: FacultyOptions[],
  loadGroups: (programme: ProgrammeOption) => Promise<number[]>
): Promise<Omit<ImpersonationSelection, 'periodLabel'>> {
  if (p.erasmus) return exchangeRequest(p, p.erasmus.courses, options);
  const programme = resolvePersona(p, options);
  if (!programme) throw new ImpersonationError('noPlan');
  const groups = await loadGroups(programme);
  const { programId, shortCode, name, faculty, rozvrh, variants } = programme;
  return {
    programId,
    shortCode,
    name,
    faculty,
    year: p.year,
    group: groups[0] ?? null,
    rozvrh,
    variants,
    personaId: p.id,
  };
}

/**
 * The Erasmus persona's request (design 2026-11-27 §4): Z-EXC at its faculty,
 * no programme, no group, and the pinned courses that IS's course select still
 * lists this period. A code that no longer resolves is left out here and
 * reported by `npm run personas:check`; none at all is noPlan.
 */
function exchangeRequest(
  p: Persona,
  codes: string[],
  options: FacultyOptions[]
): Omit<ImpersonationSelection, 'periodLabel'> {
  const known = options.find((f) => f.faculty === p.faculty)?.courses ?? [];
  const found = codes.flatMap((code) => known.filter((c) => c.code === code).slice(0, 1));
  const first = found[0];
  if (!first) throw new ImpersonationError('noPlan');
  return {
    programId: '',
    shortCode: EXCHANGE_PROGRAMME,
    name: '',
    faculty: p.faculty,
    year: p.year,
    group: null,
    rozvrh: first.rozvrh,
    erasmus: true,
    courses: found.map(({ code, predmetId }) => ({ code, predmetId })),
    personaId: p.id,
  };
}
