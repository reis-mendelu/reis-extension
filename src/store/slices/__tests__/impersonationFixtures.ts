import type {
  ImpersonationResult,
  ImpersonationSelection,
  RozvrhRef,
} from '../../../api/impersonation/types';

/** A PEF B-F first-year, as today's picker asks for one (made-up ids). */
const ROZVRH: RozvrhRef = {
  id: '5769',
  z: '20260921',
  k: '20261213',
  label: '',
  period: 'ZS 2026/2027',
  faculty: 'PEF',
  form: 'prezenční',
  start: '21.09.2026',
  end: '20.12.2026',
};

const plan = {
  title: 'B-F',
  isFulfilled: false,
  creditsAcquired: 0,
  creditsRequired: 180,
  blocks: [],
};

export const PERSONA_REQ: Omit<ImpersonationSelection, 'periodLabel'> = {
  programId: '1889',
  shortCode: 'B-F',
  name: 'Finance',
  faculty: 'PEF',
  year: 1,
  group: 2,
  rozvrh: ROZVRH,
};

export const PERSONA_RESULT: ImpersonationResult = {
  resolved: { programId: '1889', shortCode: 'B-F', rozvrh: ROZVRH },
  plan: { cz: plan, en: plan },
  schedule: [],
  subjects: { version: 1, lastUpdated: 'x', data: {} },
  fetchedAt: 1,
};
