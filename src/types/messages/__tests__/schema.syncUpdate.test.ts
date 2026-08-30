import { describe, it, expect } from 'vitest';
import { ContentToIframeSchema } from '../schema';

// Exercises REIS_SYNC_UPDATE.data (SyncedData, coarse shape guards), deepened
// in Tier 1 #2a. The load-bearing property is fail-closed safety: it must
// NEVER reject a real payload (whole-payload blast radius = empty app), while
// still catching gross corruption.

const parse = (m: unknown) => ContentToIframeSchema.safeParse(m).success;

const realSync = {
  type: 'REIS_SYNC_UPDATE',
  data: {
    lastSync: 1_720_000_000_000,
    isSyncing: false,
    schedule: [{ id: 'l1' }],
    exams: [{ version: 1, id: 'EBC-ALG' }],
    cvicneTests: [],
    classmates: { 'EBC-ALG': { all: [] } },
    zaznamnik: { 'EBC-ALG': null },
    notes: { 'EBC-ALG': { f1: { note: 'x', fileName: 'a.pdf' } } },
    subjects: { anyShape: true },
    studyPlan: { cz: {}, en: {} },
  },
};

describe('REIS_SYNC_UPDATE (SyncedData) schema', () => {
  it('accepts a representative real sync payload (never drops valid data)', () => {
    expect(parse(realSync)).toBe(true);
  });

  it('accepts a minimal payload (only lastSync)', () => {
    expect(parse({ type: 'REIS_SYNC_UPDATE', data: { lastSync: 1 } })).toBe(true);
  });

  it('accepts unknown/future top-level fields (additive tolerance)', () => {
    expect(parse({ type: 'REIS_SYNC_UPDATE', data: { lastSync: 1, brandNewField: 42 } })).toBe(
      true
    );
  });

  it('accepts schedule as a dual-language {cz,en} object (domain fields stay permissive)', () => {
    // syncService sends schedule as {cz,en}, not a flat array — must not drop it.
    expect(
      parse({ type: 'REIS_SYNC_UPDATE', data: { lastSync: 1, schedule: { cz: [], en: [] } } })
    ).toBe(true);
  });

  it('rejects gross corruption: data is null', () => {
    expect(parse({ type: 'REIS_SYNC_UPDATE', data: null })).toBe(false);
  });

  it('rejects gross corruption: lastSync is not a number', () => {
    expect(parse({ type: 'REIS_SYNC_UPDATE', data: { lastSync: 'soon' } })).toBe(false);
  });
});
