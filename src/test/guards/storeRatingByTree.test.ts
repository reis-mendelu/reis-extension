import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Rating reIS in its store reaches both trees, in a different shape on each.
 * Both halves are pinned here so a later "let's reuse that" does not quietly
 * undo either one.
 *
 * PHONE AND IPAD: the OS's own rating dialog, asked right after a success
 * moment (src/mobile/storeReview.ts, rule in utils/storeReviewDecision.ts).
 * There is deliberately NO manual "Ohodnotit reIS" row in Profil: Profil must
 * not scroll, and at 375×667 (iPhone SE) it fits with 0px to spare — see
 * components/mobile/screens/profile/AboutSection.tsx, which already gives up
 * its own block on short screens to keep that true.
 *
 * EXTENSION: no OS dialog exists in a browser, so a quiet link in the profile
 * popup's support block (Sidebar/Profile/RateReisLink.tsx) and never a prompt.
 * Nothing in the extension may ask unprompted; the shared callers reach
 * maybeAskForStoreReview, which returns early outside Capacitor.
 *
 * Decided 2026-11-15: never a "do you like reIS?" pre-screen that routes only
 * happy students to the store (Apple 5.6.1, Google policy), never an incentive.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('store rating, by tree', () => {
  it('the extension has a quiet link in the profile popup', () => {
    expect(read('src/components/Sidebar/ProfilePopup.tsx')).toContain('<RateReisLink />');
    expect(read('src/components/Sidebar/Profile/RateReisLink.tsx')).toContain('extensionReviewUrl');
  });

  it('the phone has no manual row in Profil', () => {
    expect(read('src/components/mobile/screens/ProfileScreen.tsx')).not.toContain('RateReis');
    expect(read('src/components/mobile/screens/profile/AboutSection.tsx')).not.toContain(
      'RateReis'
    );
  });

  it('the phone asks the OS only from the native helper, which bails outside Capacitor', () => {
    const helper = read('src/mobile/storeReview.ts');
    expect(helper).toContain("getPlatform().kind === 'capacitor'");
    expect(helper).toContain("import('@capacitor-community/in-app-review')");
    expect(helper).not.toMatch(/^import .*in-app-review/m);
  });

  it('the success moments call the helper', () => {
    expect(read('src/components/ExamPanel/useExamActions.ts')).toContain(
      "maybeAskForStoreReview('exam_registered')"
    );
    expect(read('src/hooks/data/useEduroamSetup.ts')).toContain(
      "maybeAskForStoreReview('eduroam_saved')"
    );
  });

  it('days of use are counted at boot after the demo return, and on resume', () => {
    const src = read('capacitor/startApp.ts');
    const demoReturn = src.indexOf('if (demo) return;');
    const boot = src.indexOf('void noteAppUsedToday();');
    expect(demoReturn).toBeGreaterThan(-1);
    expect(boot).toBeGreaterThan(demoReturn);
    const resume = src.indexOf("CapApp.addListener('resume'");
    expect(src.slice(resume)).toMatch(/\bnoteAppUsedToday\(\)/);
  });
});
