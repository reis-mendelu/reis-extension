// The keys the overview compares with its record: unique within one answer, or one row's
// fingerprint overwrites another's and an unchanged overview reports it as changed.
import { describe, it, expect } from 'vitest';
import { boxRows, pointRows } from '../overviewShape';

const arch = (name: string, v: string) => ({ name, columns: ['Body'], values: [v] });
const keys = (rows: { key: string }[]) => rows.map((r) => r.key);

describe('pointRows keys', () => {
  it('keeps repeated labels apart, even when a label already looks like a suffixed one', () => {
    const rows = pointRows({
      continuousAssessment: [
        { label: 'S', arches: [arch('Test', '1'), arch('Test', '2'), arch('Test #2', '3')] },
      ],
    });
    expect(new Set(keys(rows)).size).toBe(3);
    // and the same input gives the same keys again
    const again = pointRows({
      continuousAssessment: [
        { label: 'S', arches: [arch('Test', '1'), arch('Test', '2'), arch('Test #2', '3')] },
      ],
    });
    expect(keys(again)).toEqual(keys(rows));
  });

  it('keeps one label alone as it is', () => {
    const rows = pointRows({ continuousAssessment: [{ label: 'S', arches: [arch('T1', '1')] }] });
    expect(keys(rows)).toEqual(['S / T1']);
  });
});

describe('boxRows keys', () => {
  it('keeps boxes with one name apart, even when another name looks like a suffixed one', () => {
    const box = (name: string) => ({ courseCode: 'A-1', name, deadline: '1.1.2030 10:00' });
    const rows = boxRows({ assignments: [box('Esej'), box('Esej'), box('Esej|2')] }, 0);
    expect(new Set(keys(rows)).size).toBe(3);
  });
});

describe('boxRows open flag', () => {
  // 9 Dec 2026 12:00 UTC is 13:00 in Prague. IS prints deadlines in Prague time, so the flag must
  // not move with the computer's own zone.
  const now = Date.UTC(2026, 11, 9, 12, 0);
  const box = (deadline: string) => ({ courseCode: 'A-1', name: 'Esej', deadline });
  it('reads a deadline as Prague time', () => {
    expect(boxRows({ assignments: [box('9.12.2026 13:30')] }, now)[0]?.open).toBe(true);
    expect(boxRows({ assignments: [box('9.12.2026 12:30')] }, now)[0]?.open).toBe(false);
  });
});

describe('boxRows keys for boxes with one name', () => {
  it('does not move a key when the list order changes after a hand-in', () => {
    const a = { courseCode: 'A-1', name: 'Esej', deadline: '1.1.2030 10:00' };
    const b = { courseCode: 'A-1', name: 'Esej', deadline: '8.1.2030 10:00' };
    const before = boxRows({ assignments: [a, b] }, 0);
    const after = boxRows({ assignments: [b, a] }, 0);
    const byDeadline = (rows: ReturnType<typeof boxRows>) =>
      Object.fromEntries(rows.map((r) => [r.deadline, r.key]));
    expect(byDeadline(after)).toEqual(byDeadline(before));
  });
});

describe('boxRows keys with IS box ids', () => {
  const box = (id: string, deadline: string) => ({
    courseCode: 'A-1',
    name: 'Esej',
    deadline,
    odevzdavarnaId: id,
  });
  it('keeps a box on its key when its deadline moves, the list reorders or a twin appears', () => {
    const [first] = boxRows({ assignments: [box('11', '1.1.2030 10:00')] }, 0);
    const moved = boxRows(
      { assignments: [box('22', '5.1.2030 10:00'), box('11', '9.1.2030 10:00')] },
      0
    );
    expect(moved.find((r) => r.deadline === '9.1.2030 10:00')?.key).toBe(first?.key);
  });
});
