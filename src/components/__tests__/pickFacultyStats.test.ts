import { describe, it, expect } from 'vitest';
import { pickFacultyStats } from '../SuccessRate/pickFacultyStats';

const s = (semesterName: string) => ({ semesterName });

describe('pickFacultyStats', () => {
  const stats = [s('LS 2025/2026 - PEF'), s('ZS 2025/2026 - PEF'), s('LS 2024/2025 - PEF')];

  it('returns all stats when no faculty code is given', () => {
    expect(pickFacultyStats(stats, undefined)).toHaveLength(3);
  });

  it('keeps only the matching faculty when the code matches (Czech code)', () => {
    const mixed = [...stats, s('LS 2025/2026 - AF')];
    expect(pickFacultyStats(mixed, 'PEF')).toHaveLength(3);
  });

  it('falls back to all stats when the faculty code never matches (EN code FBE vs data PEF)', () => {
    // The bug: EN search passes "FBE"; data is labelled "PEF". Must still show data.
    expect(pickFacultyStats(stats, 'FBE')).toHaveLength(3);
  });
});
