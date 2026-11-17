import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkDisclosures, readRepoSnapshot } from '../../privacy/check';
import {
  FLOWS,
  EXEMPT,
  PLATFORM_PERMISSIONS,
  SCHOOL_LISTING_FLOWS,
} from '../../../privacy/disclosures';
import { ALL_FEATURES, SCHOOL_PROFILES } from '../../../src/utils/schoolProfiles';
import { REIS_CONTACT_EMAIL } from '../../../src/utils/reisContact';

const ROOT = resolve(__dirname, '../../..');

/**
 * privacy:check against the real tree. This is what makes privacy/disclosures.ts
 * binding: a new Supabase call, a Firefox category, an iOS usage key, an Android
 * permission, a Play data type or a policy-table edit that the source does not
 * describe fails the required Unit tests job — for every contributor, Claude or
 * not. The fix is to describe the flow in privacy/disclosures.ts; the release
 * checklist then tells the release which stores to update.
 */
describe('privacy disclosures', () => {
  it('describe every data flow the code, manifests and policy contain', () => {
    const findings = checkDisclosures(readRepoSnapshot(ROOT), {
      flows: FLOWS,
      exempt: EXEMPT,
      permissions: PLATFORM_PERMISSIONS,
    });
    expect(findings, findings.join('\n')).toEqual([]);
  });
});

/**
 * A school's own listing (VŠE) has its own policy, which says what that build
 * sends. privacy:check above reads MENDELU's manifest and policy only, so this
 * holds the other listings to theirs; scripts/__tests__/schoolManifest.test.ts
 * holds their manifests.
 */
describe('school listings', () => {
  const listed = Object.values(SCHOOL_PROFILES).filter((p) => p.listing);

  it('each listing names its flows in privacy/disclosures.ts', () => {
    expect(listed.map((p) => p.id).sort()).toEqual(Object.keys(SCHOOL_LISTING_FLOWS).sort());
  });

  it.each(listed.map((p) => [p.id, p] as const))(
    '%s: a policy that says "nothing" is a build with no feature that could send',
    (id, profile) => {
      const flows = SCHOOL_LISTING_FLOWS[id] ?? [];
      for (const flow of flows) expect(FLOWS.map((f) => f.id)).toContain(flow);
      if (flows.length === 0) {
        expect(
          ALL_FEATURES.filter((f) => profile.features[f]),
          `${profile.listing?.privacyPolicyDoc} says ${profile.name} sends nothing`
        ).toEqual([]);
      }
    }
  );

  it.each(listed.map((p) => [p.id, p] as const))(
    '%s: its policy is in the repo, about its own IS, with our contact',
    (_id, profile) => {
      const policy = readFileSync(resolve(ROOT, profile.listing?.privacyPolicyDoc ?? ''), 'utf-8');
      expect(policy).toContain(profile.host);
      expect(policy).toContain(REIS_CONTACT_EMAIL);
      expect(policy).not.toMatch(/mendelu\.cz|supabase/i);
    }
  );
});
