/**
 * Eligibility decides whether a student is offered as a tutor or a tutee. Getting
 * the direction wrong is the bad failure: it offers someone who failed a course
 * as the person who teaches it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const getUserParams = vi.hoisted(() => vi.fn());

vi.mock('../../storage', () => ({ IndexedDBService: { get } }));
vi.mock('../../../utils/userParams', () => ({ getUserParams }));

import { checkStudyJamEligibility } from '../studyJamEligibility';

const KILLERS = [
  { course_code: 'EBC-OS', course_name: 'Operating Systems' },
  { course_code: 'EBC-MAT', course_name: 'Mathematics' },
];

/** Wire the two IDB reads the function makes, by store name. */
function idb({ grades, subjects }: { grades?: unknown[]; subjects?: string[] }) {
  get.mockImplementation(async (store: string) => {
    if (store === 'grade_history') return grades ? { grades } : null;
    if (store === 'subjects')
      return subjects ? { data: Object.fromEntries(subjects.map((s) => [s, {}])) } : null;
    return null;
  });
}

const grade = (courseCode: string, gradeLetter: string, period: string) => ({
  courseCode,
  gradeLetter,
  period,
});

beforeEach(() => {
  vi.clearAllMocks();
  getUserParams.mockResolvedValue({ studySemester: 5 });
});

describe('guards', () => {
  it('returns nothing when there are no killer courses', async () => {
    expect(await checkStudyJamEligibility([])).toEqual([]);
    expect(getUserParams).not.toHaveBeenCalled();
  });

  it('returns nothing when the user params are unavailable', async () => {
    getUserParams.mockResolvedValue(null);
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });

  it('survives an empty grade history and no subjects', async () => {
    idb({});
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });
});

describe('tutor selection', () => {
  it('offers a student with an A in a recent semester as tutor', async () => {
    idb({ grades: [grade('EBC-OS', 'A', 'ZS 2025/2026')] });

    expect(await checkStudyJamEligibility(KILLERS)).toEqual([
      { courseCode: 'EBC-OS', courseName: 'Operating Systems', role: 'tutor' },
    ]);
  });

  it('accepts a B as well as an A', async () => {
    idb({ grades: [grade('EBC-OS', 'B', 'ZS 2025/2026')] });
    expect(await checkStudyJamEligibility(KILLERS)).toHaveLength(1);
  });

  it('rejects a C', async () => {
    idb({ grades: [grade('EBC-OS', 'C', 'ZS 2025/2026')] });
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });

  it('ignores an A older than the two most recent semesters', async () => {
    // Two years on, the student has forgotten enough that they are not the right
    // person to teach it.
    idb({
      grades: [
        grade('EBC-OS', 'A', 'ZS 2023/2024'),
        grade('EBC-MAT', 'A', 'LS 2025/2026'),
        grade('EBC-MAT', 'A', 'ZS 2025/2026'),
      ],
    });

    const out = await checkStudyJamEligibility(KILLERS);
    expect(out.map((s) => s.courseCode)).toEqual(['EBC-MAT']);
  });

  it('ranks LS above ZS of the same academic year when picking the top two', async () => {
    // Three distinct periods, so the window actually has to drop one. LS is the
    // later half of the year, so LS 25/26 > ZS 25/26 > LS 24/25 and the oldest
    // goes. If LS and ZS scored equally the two 25/26 rows would collapse into
    // one slot and LS 24/25 would survive instead.
    idb({
      grades: [
        grade('EBC-OS', 'A', 'LS 2025/2026'),
        grade('EBC-MAT', 'A', 'ZS 2025/2026'),
        grade('EBC-DB', 'A', 'LS 2024/2025'),
      ],
    });

    const out = await checkStudyJamEligibility([
      ...KILLERS,
      { course_code: 'EBC-DB', course_name: 'Databases' },
    ]);

    expect(out.map((s) => s.courseCode)).toEqual(['EBC-OS', 'EBC-MAT']);
  });

  it('ignores an A in a course nobody struggles with', async () => {
    idb({ grades: [grade('EBC-EASY', 'A', 'ZS 2025/2026')] });
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });

  it('offers each course once even with several qualifying grades', async () => {
    idb({
      grades: [grade('EBC-OS', 'A', 'LS 2025/2026'), grade('EBC-OS', 'B', 'ZS 2025/2026')],
    });
    expect(await checkStudyJamEligibility(KILLERS)).toHaveLength(1);
  });

  it('skips a grade row with no course code', async () => {
    idb({ grades: [grade('', 'A', 'ZS 2025/2026')] });
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });
});

describe('tutee selection', () => {
  it('offers a first-year enrolled in a killer course as tutee', async () => {
    getUserParams.mockResolvedValue({ studySemester: 1 });
    idb({ subjects: ['EBC-OS'] });

    expect(await checkStudyJamEligibility(KILLERS)).toEqual([
      { courseCode: 'EBC-OS', courseName: 'Operating Systems', role: 'tutee' },
    ]);
  });

  it('stops offering tutee places after the second semester', async () => {
    getUserParams.mockResolvedValue({ studySemester: 3 });
    idb({ subjects: ['EBC-OS'] });
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });

  it('treats a missing studySemester as too senior to be a tutee', async () => {
    getUserParams.mockResolvedValue({});
    idb({ subjects: ['EBC-OS'] });
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });

  it('ignores enrolled courses that are not killers', async () => {
    getUserParams.mockResolvedValue({ studySemester: 1 });
    idb({ subjects: ['EBC-EASY'] });
    expect(await checkStudyJamEligibility(KILLERS)).toEqual([]);
  });
});

describe('tutor beats tutee', () => {
  it('does not offer a course as tutee when it already qualified as tutor', async () => {
    // A first-year retaking a course they already passed with an A: they are the
    // teacher here, and offering both roles for one course reads as a bug.
    getUserParams.mockResolvedValue({ studySemester: 1 });
    idb({ grades: [grade('EBC-OS', 'A', 'ZS 2025/2026')], subjects: ['EBC-OS'] });

    const out = await checkStudyJamEligibility(KILLERS);

    expect(out).toHaveLength(1);
    expect(out[0]!.role).toBe('tutor');
  });

  it('can offer tutor for one course and tutee for another', async () => {
    getUserParams.mockResolvedValue({ studySemester: 1 });
    idb({ grades: [grade('EBC-OS', 'A', 'ZS 2025/2026')], subjects: ['EBC-MAT'] });

    const out = await checkStudyJamEligibility(KILLERS);

    expect(out).toEqual([
      { courseCode: 'EBC-OS', courseName: 'Operating Systems', role: 'tutor' },
      { courseCode: 'EBC-MAT', courseName: 'Mathematics', role: 'tutee' },
    ]);
  });
});
