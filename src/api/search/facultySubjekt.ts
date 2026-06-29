/**
 * IS Mendelu "Pracoviště" (workplace) ids used by the catalog search (`hledani`)
 * `subjekt` filter to restrict subject results to a single faculty.
 *
 * Keyed by the faculty acronym stored in `userFaculty` (params.facultyLabel),
 * which is one of PEF / AF / LDF / ZF / FRRMS / ICV.
 *
 * Restricting subject search to the student's own faculty removes the cross-faculty
 * noise that otherwise pushes the relevant subject past the result cap, making
 * subject search reliable on the first try for the ~90% in-faculty case.
 */
export const FACULTY_SUBJEKT_ID: Record<string, string> = {
  PEF: '43110',
  AF: '43210',
  LDF: '43410',
  ZF: '43510',
  FRRMS: '43310',
  ICV: '43710',
};

/** Resolve a faculty acronym to its IS workplace id, or undefined to search university-wide. */
export function facultySubjektId(userFaculty: string | null | undefined): string | undefined {
  if (!userFaculty) return undefined;
  return FACULTY_SUBJEKT_ID[userFaculty.trim().toUpperCase()];
}
