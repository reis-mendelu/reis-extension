import type { ImpersonationErrorCode } from '../../api/impersonation/types';

/** The picker's and the persona rows' error lines, one wording for both. */
export const IMPERSONATION_ERROR_KEY: Record<ImpersonationErrorCode, string> = {
  options: 'impersonation.errorOptions',
  timetable: 'impersonation.errorTimetable',
  noPlan: 'impersonation.errorNoPlan',
  noSemester: 'impersonation.errorNoSemester',
  notAdmin: 'impersonation.errorNotAdmin',
  expired: 'impersonation.expired',
  storage: 'impersonation.errorStorage',
};
