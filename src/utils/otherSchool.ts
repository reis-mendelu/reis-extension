/**
 * True only in a prototype build for another UIS school (`REIS_IS_HOST=…`,
 * scripts/isHostSwap.ts). It hides what exists only at MENDELU or only through
 * Supabase: the campus map, eduroam (MENDELU's RADIUS server), Novinky and
 * partners, the bug report, study documents, practice tests and impersonation.
 * False in every real build.
 */
export const IS_OTHER_SCHOOL = import.meta.env.VITE_REIS_OTHER_SCHOOL === '1';

/** Menu ids that point at a MENDELU-only feature. */
export const MENDELU_ONLY_MENU_IDS = new Set(['map', 'testy', 'dokumenty']);
