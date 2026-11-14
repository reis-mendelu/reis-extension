import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_FEATURES, SCHOOL_PROFILES } from '../../utils/schoolProfiles';

/**
 * A build for another UIS school (`REIS_SCHOOL=vse|czu`, scripts/isHostSwap.ts)
 * hides what only MENDELU has: its profile in utils/schoolProfiles.ts lacks the
 * feature, and the code that offers it asks `currentSchool.has(feature)`. That
 * is the EXTENSION only, on purpose: the phone app is not going to other
 * schools yet, and a school picker on its login screen would cost every
 * MENDELU student a step (Dominik, 2026-11-13). So these gates live in the
 * desktop tree and in shared slices whose fetches the phone never makes in
 * such a build. Why each feature is MENDELU's own is written on the table.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('school profiles in the build', () => {
  it("VŠE's profile has none of MENDELU's own features, the map first", () => {
    expect(SCHOOL_PROFILES.vse.features.campusMap).toBe(false);
    expect(ALL_FEATURES.filter((f) => SCHOOL_PROFILES.vse.features[f])).toEqual([]);
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
  ])('%s gates its MENDELU-only part on currentSchool.has', (file) => {
    expect(read(file)).toContain('currentSchool.has(');
    expect(read(file)).not.toContain('IS_OTHER_SCHOOL');
  });

  it('data/pages/index.ts trims Starý IS to general UIS outside MENDELU', () => {
    expect(read('data/pages/index.ts')).toContain("currentSchool.id === 'mendelu'");
  });
});
