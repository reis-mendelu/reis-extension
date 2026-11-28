import type { SubjectZaznamnik } from '../../types/zaznamnik';

/**
 * The Záznamník tab's badge, for both drawers (the desktop SubjectFileDrawer
 * and the phone/iPad SubjectDrawerSheet): filled arches, test attempts and
 * submission boxes, which all live on that tab. `undefined` = no badge.
 *
 * None while impersonating: the records store is keyed by subject code, so a
 * subject the persona shares with the admin holds the admin's own marks, and
 * the tab shows the persona note instead of them.
 */
export function zaznamnikTabCount(
  data: SubjectZaznamnik | null | undefined,
  boxCount: number,
  impersonating: boolean
): number | undefined {
  if (impersonating) return undefined;
  if (!data && boxCount === 0) return undefined;
  const ph = data?.ph.sections.reduce((n, s) => n + s.arches.filter((a) => !a.empty).length, 0);
  return (ph ?? 0) + (data?.vt.tests.length ?? 0) + boxCount;
}
