import { describe, it, expect } from 'vitest';
import {
  boxCourseCode,
  boxDeadline,
  isBoxOpen,
  splitBoxes,
  boxesDueSoon,
} from '../submissionBoxes';
import type { Odevzdavarna } from '../../api/odevzdavarny';

const NOW = new Date(2026, 9, 3, 12, 0).getTime(); // 3 Oct 2026 12:00

const box = (over: Partial<Odevzdavarna>): Odevzdavarna => ({
  courseId: '1',
  courseNameCs: 'Java',
  courseNameEn: 'Java',
  name: 'Projekt',
  type: '',
  deadline: '08.11.2026 23:59',
  odevzdavarnaId: '1',
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
  ...over,
});

describe('submission boxes', () => {
  it('reads the Czech deadline as local time', () => {
    expect(boxDeadline(box({}))?.getTime()).toBe(new Date(2026, 10, 8, 23, 59).getTime());
    expect(boxDeadline(box({ deadline: '' }))).toBeNull();
  });

  it('treats a box cached by an older build (no isOpen) as open until its deadline', () => {
    expect(isBoxOpen(box({}), NOW)).toBe(true);
    expect(isBoxOpen(box({ deadline: '01.10.2026 10:00' }), NOW)).toBe(false);
  });

  it('closes a box IS says is closed, whatever its deadline', () => {
    expect(isBoxOpen(box({ isOpen: false }), NOW)).toBe(false);
  });

  it('keeps a box without a readable deadline open while IS says so', () => {
    expect(isBoxOpen(box({ deadline: '' }), NOW)).toBe(true);
  });

  it('splits open (soonest first) from closed (latest first)', () => {
    const { open, closed } = splitBoxes(
      [
        box({ name: 'later', deadline: '31.01.2027 04:27' }),
        box({ name: 'old', deadline: '22.02.2026 21:00', isOpen: false }),
        box({ name: 'soon', deadline: '05.10.2026 10:00' }),
        box({ name: 'newer', deadline: '26.04.2026 23:59', isOpen: false }),
      ],
      NOW
    );
    expect(open.map((b) => b.name)).toEqual(['soon', 'later']);
    expect(closed.map((b) => b.name)).toEqual(['newer', 'old']);
  });

  it('due soon: open, nothing uploaded, within the window — not the box left open all year', () => {
    const due = boxesDueSoon(
      [
        box({ name: 'in 5 days', deadline: '08.10.2026 23:59' }),
        box({ name: 'uploaded', deadline: '06.10.2026 23:59', fileCount: 1 }),
        box({ name: 'all year', deadline: '31.01.2027 04:27' }),
        box({ name: 'closed', deadline: '04.10.2026 10:00', isOpen: false }),
      ],
      NOW,
      14
    );
    expect(due.map((b) => b.name)).toEqual(['in 5 days']);
  });
});

describe('boxCourseCode', () => {
  it('uses the code the parser read from IS', () => {
    expect(boxCourseCode(box({ courseCode: 'EBC-PJ' }), {})).toBe('EBC-PJ');
  });

  it('falls back to the subject whose predmet id matches', () => {
    expect(boxCourseCode(box({ courseId: 'P1' }), { 'EBC-PJ': { subjectId: 'P1' } })).toBe(
      'EBC-PJ'
    );
  });

  it('answers null when neither is known', () => {
    expect(boxCourseCode(box({ courseId: 'P1' }), { X: { subjectId: 'P2' } })).toBeNull();
    expect(boxCourseCode(box({ courseId: 'P1' }), undefined)).toBeNull();
  });
});
