import { describe, it, expect } from 'vitest';
import { parseDiagnostics } from '../diagnostics.schema';

/**
 * Builds already in the stores keep sending the 5.3.0 shape, and the admin
 * console parses every stored row with this schema. Fields added since must be
 * optional, or every report from an older build renders as "no diagnostics".
 */
const V530 = {
  entries: [],
  env: { platform: 'android', os: 'Android 17', lang: 'cz', online: true, uptimeS: 60 },
  sync: {
    lastSync: null,
    isSyncing: false,
    schedule: 'success',
    exams: 'success',
    scheduleCount: 136,
    examsCount: 0,
    examsFetchedAt: null,
  },
};

describe('parseDiagnostics', () => {
  it('still reads a 5.3.0 payload', () => {
    expect(parseDiagnostics(V530)).not.toBeNull();
  });

  it('reads the sync answers a newer build sends', () => {
    const out = parseDiagnostics({
      ...V530,
      sync: { ...V530.sync, firstSyncSettled: true, syncLoaded: ['schedule'], syncFailed: false },
    });
    expect(out?.sync.syncLoaded).toEqual(['schedule']);
    expect(out?.sync.firstSyncSettled).toBe(true);
    expect(out?.sync.syncFailed).toBe(false);
  });
});
