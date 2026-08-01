import { describe, it, expect } from 'vitest';
import { resolveNowNext } from '../nowNext';
import { makeLesson as lesson } from '../../../test/fixtures/lesson';

describe('resolveNowNext', () => {
  it('returns null when nothing is running', () => {
    const l = [lesson({ startTime: '14:00', endTime: '15:50' })];
    expect(resolveNowNext(l, new Date('2026-04-20T09:30:00'))).toBeNull();
  });

  it('finds the running lesson and its elapsed percentage', () => {
    const l = [lesson({ startTime: '09:00', endTime: '11:00' })];
    const r = resolveNowNext(l, new Date('2026-04-20T10:00:00'));
    expect(r?.current.id).toBe('l1');
    expect(r?.elapsedPct).toBe(50);
    expect(r?.minutesLeft).toBe(60);
  });

  it('reports the next lesson of the same day', () => {
    const l = [
      lesson({ id: 'a', startTime: '09:00', endTime: '10:50' }),
      lesson({ id: 'b', startTime: '11:00', endTime: '12:50', courseName: 'Mikroekonomie I' }),
    ];
    const r = resolveNowNext(l, new Date('2026-04-20T10:00:00'));
    expect(r?.next?.id).toBe('b');
  });

  it('reports next as null when the running lesson is the last of the day', () => {
    const l = [lesson({ startTime: '09:00', endTime: '10:50' })];
    const r = resolveNowNext(l, new Date('2026-04-20T10:00:00'));
    expect(r?.next).toBeNull();
  });

  it('ignores lessons on other days', () => {
    const l = [lesson({ date: '20260421', startTime: '09:00', endTime: '11:00' })];
    expect(resolveNowNext(l, new Date('2026-04-20T10:00:00'))).toBeNull();
  });

  it('clamps elapsed percentage into 0..100', () => {
    const l = [lesson({ startTime: '09:00', endTime: '11:00' })];
    const r = resolveNowNext(l, new Date('2026-04-20T09:00:00'));
    expect(r?.elapsedPct).toBe(0);
  });
});
