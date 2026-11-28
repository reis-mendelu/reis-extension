import {
  ImpersonationError,
  type FacultyOptions,
  type ImpersonationSelection,
  type ProgrammeOption,
} from '../api/impersonation/types';

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
   * id: ids change with every accreditation. Null for Erasmus (step C).
   */
  shortCode: string | null;
  year: 1;
  /** Erasmus only (step C): the pinned English-taught course codes. */
  erasmus?: { courses: string[] };
  /** Erasmus only (step C): the UI language while the persona is active. */
  language?: 'en';
}

/**
 * Decision #1: seven programme personas, all first year. B-OI stays although
 * Dominik studies it: Tonda (B-F) uses it. Erasmus is step C.
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
];

export const personaById = (id: string | undefined): Persona | undefined =>
  PERSONAS.find((p) => p.id === id);

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
