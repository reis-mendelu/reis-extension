/**
 * Regression test for a truthiness bug in get()/set() that discarded falsy
 * values instead of treating them as real data.
 *
 * The crash-report opt-out (`reis_error_reporting_enabled`, see
 * createErrorReportingSlice.ts) is persisted under the 'meta' store as a
 * plain boolean. Before e91c7cf5, get() did `value ? validate(...) : undefined`
 * and set() did `if (!validated) return`, so storing `false` — a student
 * turning crash reporting OFF — was either never written or read back as
 * `undefined` on the next app start. The effect: the opt-out silently reverted
 * to the default (enabled) on every reload, and telemetry kept firing for a
 * student who had explicitly refused it. This shipped in 5.0.6.
 *
 * These cases pin the fix (compare against the `undefined` sentinel, not
 * truthiness) so a future "simplification" back to `value ? ... : undefined`
 * cannot land without a red test.
 */

import { describe, it, expect } from 'vitest';
import { IndexedDBService } from '../IndexedDBService';

describe('IndexedDBService falsy value round-trip', () => {
  it('round-trips a stored `false` as `false`, not `undefined`', async () => {
    await IndexedDBService.set('meta', 'falsy_bool', false);
    const result = await IndexedDBService.get('meta', 'falsy_bool');
    expect(result).toBe(false);
  });

  it('round-trips a stored `0` as `0`, not `undefined`', async () => {
    await IndexedDBService.set('meta', 'falsy_number', 0);
    const result = await IndexedDBService.get('meta', 'falsy_number');
    expect(result).toBe(0);
  });

  it('round-trips a stored `""` as `""`, not `undefined`', async () => {
    await IndexedDBService.set('meta', 'falsy_string', '');
    const result = await IndexedDBService.get('meta', 'falsy_string');
    expect(result).toBe('');
  });

  it('still returns `undefined` for a key that was never written', async () => {
    const result = await IndexedDBService.get('meta', 'never_written_key');
    expect(result).toBeUndefined();
  });
});
