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
