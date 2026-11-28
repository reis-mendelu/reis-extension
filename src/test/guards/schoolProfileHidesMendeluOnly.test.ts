import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_FEATURES, SCHOOL_PROFILES, type Feature } from '../../utils/schoolProfiles';

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

  /**
   * Every gate, by file. A feature listed twice is gated in two places: removing
   * either one fails here, not only removing the last gate in a file.
   */
  const GATES: Record<string, Feature[]> = {
    'components/AppHeader.tsx': ['bulletin', 'internships', 'novinky'],
    'components/AppMain.tsx': ['campusMap', 'erasmus'],
    'components/AppOverlays.tsx': [
      'welcome',
      'eduroam',
      'reports',
      'studyDocuments',
      'impersonation',
      'impersonation',
    ],
    'components/Sidebar/BottomActions.tsx': ['teamsOutlook', 'adminConsole'],
    // 'reports' twice: the report form for MENDELU, and an e-mail to reIS
    // where a school has no reports (components/Sidebar/Profile/ContactLink.tsx).
    // Extension only, like every gate here: the phone app is MENDELU's alone.
    'components/Sidebar/ProfilePopup.tsx': [
      'adminConsole',
      'adminConsole',
      'eduroam',
      'partners',
      'reports',
      'reports',
      'storeRating',
      'guides',
    ],
    // The phone's Nápověda row gates itself.
    'components/mobile/screens/profile/HelpRow.tsx': ['guides'],
    'components/SubjectFileDrawer/Header/CourseMeta.tsx': ['campusMap'],
    'components/SubjectFileDrawer/Header/HeaderTabs.tsx': ['successRates'],
    'components/Feedback/ReportMissingLink.tsx': ['reports'],
    'hooks/useAppLogic.ts': ['campusMap', 'campusMap', 'erasmus'],
    'store/slices/createMenuSlice.ts': ['canteenMenu'],
    'store/slices/createSuccessRateSlice.ts': ['successRates', 'successRates'],
    'store/slices/createSimilarSubjectsSlice.ts': ['similarSubjects'],
    // Novinky and questions; the IS notices and their mute list; society
    // events, pins and venues (novinky or campusMap, one helper).
    'store/useAppStore.ts': ['novinky', 'novinky', 'novinky', 'campusMap'],
    // Nothing is sent to reIS at all without the counts: the daily count and
    // every feature counter (VŠE at launch, docs/privacy-policy-vse.md).
    'api/feedback.ts': ['usageCounts'],
    'api/featureUsage.ts': ['usageCounts'],
    'components/SearchBar/useSearch.ts': ['facultySearchScope'],
    'components/SubjectFileDrawer/useSubjectFileDrawerState.ts': ['successRates', 'successRates'],
    'components/Feedback/reportPrefill.ts': ['reports'],
  };

  it.each(Object.entries(GATES))('%s gates each MENDELU-only part', (file, features) => {
    const code = read(file);
    expect(code).not.toContain('IS_OTHER_SCHOOL');
    for (const feature of new Set(features)) {
      const gates = code.split(`currentSchool.has('${feature}')`).length - 1;
      expect(gates, `${file}: currentSchool.has('${feature}')`).toBeGreaterThanOrEqual(
        features.filter((f) => f === feature).length
      );
    }
  });

  // GATES is the whole list: a new `currentSchool.has(` anywhere else must be added
  // there, so this guard checks it too. MainItems and school.ts are covered below.
  it('lists every file that gates on currentSchool.has', () => {
    const covered = new Set([
      ...Object.keys(GATES),
      'components/Menu/MainItems.tsx',
      'utils/school.ts',
    ]);
    const root = resolve(process.cwd(), 'src');
    const unlisted = (readdirSync(root, { recursive: true }) as string[])
      .filter(
        (f) => /\.tsx?$/.test(f) && !/(^|\/)(__tests__|test)\//.test(f) && !/\.test\.tsx?$/.test(f)
      )
      .filter((f) => read(f).includes('currentSchool.has('))
      .filter((f) => !covered.has(f));
    expect(unlisted).toEqual([]);
  });

  it('components/Menu/MainItems.tsx drops each menu entry its feature gates', () => {
    const code = read('components/Menu/MainItems.tsx');
    expect(code).toContain('currentSchool.has(feature)');
    expect(code).toContain("map: 'campusMap'");
    expect(code).toContain("testy: 'practiceTests'");
    expect(code).toContain("dokumenty: 'studyDocuments'");
  });

  it('data/pages/index.ts trims Starý IS to general UIS outside MENDELU', () => {
    expect(read('data/pages/index.ts')).toContain("currentSchool.id === 'mendelu'");
  });
});
