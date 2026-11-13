import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IS_OTHER_SCHOOL } from '../../utils/otherSchool';

/**
 * A prototype build for another UIS school (`REIS_IS_HOST=is.czu.cz`,
 * scripts/isHostSwap.ts) hides what only MENDELU has. That is the EXTENSION
 * only, on purpose: the phone app is not going to other schools yet, and a
 * school picker on its login screen would cost every MENDELU student a step
 * (Dominik, 2026-11-13). So these gates live in the desktop tree and in shared
 * slices whose fetches the phone never makes in such a build.
 *
 * What is hidden and why (audits: research/czu-dump, research/vse-dump):
 * - campus map, room-to-map buttons, Erasmus: MENDELU data;
 * - canteen menu: skm.mendelu.cz, not swapped, so it would show MENDELU's canteens;
 * - success rates and similar subjects: reis-data, scraped from MENDELU only;
 * - internships: bundled MENDELU partners, which match any faculty called "PEF";
 * - Vývěska, Teams/Outlook: not general enough to keep (Dominik, 2026-11-13);
 * - Novinky, reports, eduroam, welcome, partners, admin, impersonation,
 *   documents, practice tests: Supabase or MENDELU-only.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('other-school build', () => {
  it('is off in every real build', () => {
    expect(IS_OTHER_SCHOOL).toBe(false);
  });

  it.each([
    'components/AppHeader.tsx',
    'components/AppMain.tsx',
    'components/AppOverlays.tsx',
    'components/Sidebar/BottomActions.tsx',
    'components/Sidebar/ProfilePopup.tsx',
    'components/Menu/MainItems.tsx',
    'components/SubjectFileDrawer/Header/CourseMeta.tsx',
    'components/SubjectFileDrawer/Header/HeaderTabs.tsx',
    'components/Feedback/ReportMissingLink.tsx',
    'hooks/useAppLogic.ts',
    'store/slices/createMenuSlice.ts',
    'store/slices/createSuccessRateSlice.ts',
    'store/slices/createSimilarSubjectsSlice.ts',
    'store/useAppStore.ts',
    'components/SearchBar/useSearch.ts',
    'components/SubjectFileDrawer/useSubjectFileDrawerState.ts',
    'components/Feedback/reportPrefill.ts',
  ])('%s gates its MENDELU-only part', (file) => {
    expect(read(file)).toContain('IS_OTHER_SCHOOL');
  });
});
