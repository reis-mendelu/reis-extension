import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { checkDisclosures, readRepoSnapshot } from '../../privacy/check';
import { FLOWS, EXEMPT, PLATFORM_PERMISSIONS } from '../../../privacy/disclosures';

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
    const findings = checkDisclosures(readRepoSnapshot(resolve(__dirname, '../../..')), {
      flows: FLOWS,
      exempt: EXEMPT,
      permissions: PLATFORM_PERMISSIONS,
    });
    expect(findings, findings.join('\n')).toEqual([]);
  });
});
