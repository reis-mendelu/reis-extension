import { describe, it, expect } from 'vitest';
import { TIME_OPTIONS, maskTimeInput, isCompleteTime, filterTimeOptions } from '../timeField';

describe('TIME_OPTIONS', () => {
  it('is the full day in 15-minute steps', () => {
    expect(TIME_OPTIONS).toHaveLength(96);
    expect(TIME_OPTIONS[0]).toBe('00:00');
    expect(TIME_OPTIONS.at(-1)).toBe('23:45');
    expect(TIME_OPTIONS).toContain('19:30');
    expect(TIME_OPTIONS).not.toContain('19:35');
  });
});

describe('maskTimeInput', () => {
  it('formats digits into HH:MM as they are typed', () => {
    expect(maskTimeInput('')).toBe('');
    expect(maskTimeInput('1')).toBe('1');
    expect(maskTimeInput('19')).toBe('19');
    expect(maskTimeInput('193')).toBe('19:3');
    expect(maskTimeInput('1930')).toBe('19:30');
  });

  it('reads a leading digit >2 as a single-digit hour (no forced leading zero)', () => {
    expect(maskTimeInput('9')).toBe('09');
    expect(maskTimeInput('930')).toBe('09:30');
  });

  it('clamps impossible hours and minutes', () => {
    expect(maskTimeInput('25')).toBe('23');
    expect(maskTimeInput('1999')).toBe('19:59');
  });

  it('ignores non-digits and already-inserted colons', () => {
    expect(maskTimeInput('abc')).toBe('');
    expect(maskTimeInput('19:30')).toBe('19:30');
  });
});

describe('isCompleteTime', () => {
  it('accepts only zero-padded valid 24h times', () => {
    expect(isCompleteTime('19:30')).toBe(true);
    expect(isCompleteTime('00:00')).toBe(true);
    expect(isCompleteTime('23:45')).toBe(true);
    expect(isCompleteTime('9:30')).toBe(false);
    expect(isCompleteTime('19:3')).toBe(false);
    expect(isCompleteTime('24:00')).toBe(false);
    expect(isCompleteTime('19:60')).toBe(false);
    expect(isCompleteTime('')).toBe(false);
  });
});

describe('filterTimeOptions', () => {
  it('returns every option for empty input', () => {
    expect(filterTimeOptions('')).toHaveLength(96);
  });

  it('narrows to an hour block', () => {
    expect(filterTimeOptions('19')).toEqual(['19:00', '19:15', '19:30', '19:45']);
  });

  it('matches a single-digit hour against the zero-padded block', () => {
    expect(filterTimeOptions('9')).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });

  it('narrows further as minutes are typed', () => {
    expect(filterTimeOptions('19:3')).toEqual(['19:30']);
  });
});
