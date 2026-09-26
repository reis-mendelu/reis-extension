import { describe, it, expect } from 'vitest';
import { currentPeriod, periodLabel, intakeLabel, targetSemester } from '../intake';

// IS lists next semester first every September, so the period must come from
// the date. Same rule as reis-scraper's currentPeriodLabel.
describe('intake math', () => {
  it('September–January is ZS of Y/Y+1', () => {
    expect(periodLabel(currentPeriod(new Date(2026, 8, 26)))).toBe('ZS 2026/2027');
    expect(periodLabel(currentPeriod(new Date(2027, 0, 15)))).toBe('ZS 2026/2027');
  });
  it('February–August is LS of Y-1/Y', () => {
    expect(periodLabel(currentPeriod(new Date(2027, 2, 1)))).toBe('LS 2026/2027');
    expect(periodLabel(currentPeriod(new Date(2027, 7, 31)))).toBe('LS 2026/2027');
  });
  it('a year-N student follows the winter intake N-1 years back', () => {
    expect(intakeLabel(1, new Date(2026, 8, 26))).toBe('ZS 2026/2027');
    expect(intakeLabel(2, new Date(2026, 8, 26))).toBe('ZS 2025/2026');
    expect(intakeLabel(1, new Date(2027, 2, 1))).toBe('ZS 2026/2027');
  });
  it('target semester is 2y-1 in ZS and 2y in LS', () => {
    expect(targetSemester(1, new Date(2026, 8, 26))).toBe(1);
    expect(targetSemester(2, new Date(2026, 8, 26))).toBe(3);
    expect(targetSemester(1, new Date(2027, 2, 1))).toBe(2);
    expect(targetSemester(3, new Date(2027, 2, 1))).toBe(6);
  });
});
