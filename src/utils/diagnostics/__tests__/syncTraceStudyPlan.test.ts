import { describe, it, expect, beforeEach } from 'vitest';
import { clearDiagnostics, getDiagnostics } from '../diagnosticLog';
import { resetSyncTraces, traceStudyPlanAnswer } from '../syncTrace';

/**
 * Suggestion 46 (17 Nov 2026, Android, 5.6.0): "Předměty: prázdný seznam",
 * with schedule and exams fine, and no line about the study plan Předměty
 * draws from. The new IS markup (15 Nov 2026) collapsed 5.6.0's plan to ONE
 * semester block; a healthy plan has one per semester.
 */
const block = (n: number) => ({
  title: `b${n}`,
  groups: [{ name: 'g', subjects: [{ code: `XX${n}`, name: 'Secret name' }] }],
});
const params = { studium: 'st1', obdobi: 'ob1' };
const lines = () => getDiagnostics().filter((e) => e.ctx === 'Sync.studyPlan');

describe('traceStudyPlanAnswer', () => {
  beforeEach(() => {
    clearDiagnostics();
    resetSyncTraces();
  });

  it('records a plan collapsed to one semester block, as counts only', () => {
    traceStudyPlanAnswer({ blocks: [block(1)] }, params);
    const [line] = lines();
    expect(line?.level).toBe('warn');
    expect(line?.msg).toBe(
      'IS answered, 1 semester blocks · 1 subjects · study id present · period present'
    );
    expect(line?.msg).not.toMatch(/XX1|Secret|b1|st1|ob1/);
  });

  it('records a plan with no subjects (no KontrolaPlanu, e.g. exchange)', () => {
    traceStudyPlanAnswer({ blocks: [] }, null);
    expect(lines()[0]?.msg).toBe(
      'IS answered, 0 semester blocks · 0 subjects · study id absent · period absent'
    );
  });

  it('records blocks that hold no subjects', () => {
    traceStudyPlanAnswer({ blocks: [{ groups: [] }, { groups: [{ subjects: [] }] }] }, params);
    expect(lines()[0]?.msg).toContain('2 semester blocks · 0 subjects');
  });

  it('stays quiet on a healthy plan', () => {
    traceStudyPlanAnswer({ blocks: [block(1), block(2), block(3)] }, params);
    expect(lines()).toHaveLength(0);
  });

  it('says it once per session', () => {
    traceStudyPlanAnswer({ blocks: [block(1)] }, params);
    traceStudyPlanAnswer({ blocks: [block(1)] }, params);
    expect(lines()).toHaveLength(1);
  });
});
