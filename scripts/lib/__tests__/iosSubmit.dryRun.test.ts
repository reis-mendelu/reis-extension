import { describe, expect, it } from 'vitest';
import { submitIosVersion } from '../iosSubmit';
import { base, build, fakeAsc, versions } from './iosSubmitFakes';

// ship-dryrun.yml runs these on every pipeline PR, for the version the PR
// would release (package.json), usually before any build of it exists.
describe('submitIosVersion, dry run', () => {
  it('a dry run reads and validates but never writes', async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([['V0', '5.4.0', 'READY_FOR_SALE']]),
    });
    const out = await submitIosVersion({ ...base, asc, dryRun: true });
    expect(out.status).toBe('dry-run-ok');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('a dry run with no build yet is fine: PR dry-runs happen before any upload', async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': { data: [] },
      'GET /v1/apps/APP/appStoreVersions': versions([['V0', '5.4.0', 'READY_FOR_SALE']]),
    });
    const out = await submitIosVersion({ ...base, asc, dryRun: true });
    expect(out.status).toBe('dry-run-ok');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('a dry run with no build still names another version in review as the blocker', async () => {
    // The release PR's dry run checks its own version before that build exists;
    // a different version still waiting for review would stop the real submit.
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': { data: [] },
      'GET /v1/apps/APP/appStoreVersions': versions([
        ['V0', '5.4.0', 'WAITING_FOR_REVIEW'],
        ['V1', '5.4.1', 'PREPARE_FOR_SUBMISSION'],
      ]),
    });
    await expect(submitIosVersion({ ...base, asc, dryRun: true })).rejects.toThrow(
      /5\.4\.0 is WAITING_FOR_REVIEW/
    );
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it("a dry run does not count the released version's own draft as a blocker", async () => {
    const { asc } = fakeAsc({
      'GET /v1/builds': { data: [] },
      'GET /v1/apps/APP/appStoreVersions': versions([
        ['V0', '5.4.0', 'READY_FOR_SALE'],
        ['V1', '5.4.1', 'PREPARE_FOR_SUBMISSION'],
      ]),
    });
    const out = await submitIosVersion({ ...base, asc, dryRun: true });
    expect(out.status).toBe('dry-run-ok');
    expect(out.detail).toMatch(/No build/);
  });
});
