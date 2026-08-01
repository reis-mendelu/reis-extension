import { describe, it, expect } from 'vitest';
import { layoutExamTimeline, minColumnFor } from '../examTimelineLayout';
import type { TimelinePoint } from '../examTimeline';

// The rail width on a 390px phone: the screen minus its px-5 and the rail's own
// inset. Column widths derive from it via minColumnFor.
const WIDTH = 350;
const now = new Date('2026-07-28T09:00:00');

function pt(code: string, iso: string): TimelinePoint {
  const date = new Date(iso);
  return {
    id: code,
    subjectCode: code,
    date,
    daysLeft: Math.round((date.getTime() - now.getTime()) / 86_400_000),
    label: `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} 09:00`,
    shortLabel: `${date.getDate()}.${date.getMonth() + 1}.`,
  };
}

describe('layoutExamTimeline', () => {
  it('returns nothing for no points', () => {
    expect(layoutExamTimeline([], now, WIDTH).columns).toEqual([]);
  });

  it('centres a single point', () => {
    const { columns, progressPct } = layoutExamTimeline(
      [pt('EBC-MI', '2026-08-10T09:00')],
      now,
      WIDTH
    );
    expect(columns).toHaveLength(1);
    expect(columns[0]!.leftPct).toBe(50);
    expect(columns[0]!.title).toBe('EBC-MI');
    expect(columns[0]!.subtitle).toBe('10.8.');
    expect(progressPct).toBe(0);
  });

  // The whole point of the rewrite: spacing carries meaning. An exam a third
  // of the way through the span sits a third of the way along the rail, not
  // at the midpoint that index-spacing would have given it.
  it('positions points by date, not by index', () => {
    const { columns } = layoutExamTimeline(
      [pt('A', '2026-08-07T09:00'), pt('B', '2026-08-22T09:00'), pt('C', '2026-09-06T09:00')],
      now,
      WIDTH
    );
    // Span is 28 Jul → 6 Sep (40 days) mapped into the inset range, so the
    // three land at 1/4, 5/8 and the far end — NOT the 0 / 50 / 100 that
    // index spacing would have produced regardless of the dates.
    expect(columns.map((c) => Math.round(c.leftPct))).toEqual([30, 60, 90]);
  });

  it('merges points closer together than one column width into a cluster', () => {
    const { columns } = layoutExamTimeline(
      [
        pt('EBC-MI', '2026-07-30T09:00'),
        pt('EBC-DS', '2026-08-10T09:00'),
        pt('EBC-ST', '2026-08-13T09:00'),
        pt('EBC-I', '2026-08-18T09:00'),
      ],
      now,
      WIDTH
    );
    // 28 Jul → 18 Aug = 21 days across the inset range, so the 10th and the
    // 13th land within one column of each other and merge; the 30th and the
    // 18th are far enough out to stand alone.
    const cluster = columns.find((c) => c.count > 1);
    expect(cluster).toBeDefined();
    expect(cluster!.count).toBe(2);
    expect(cluster!.title).toBe('2×');
    expect(cluster!.subtitle).toBe('10.–13.8.');
    expect(columns.reduce((n, c) => n + c.count, 0)).toBe(4);
  });

  // The invariant the whole layout exists to guarantee. A single left-to-right
  // sweep satisfied it for the cases above but still overlapped at 320px,
  // because a merged column is drawn at its members' midpoint — which drifts
  // right of the first member the sweep measured against.
  it.each([320, 360, 390, 430])('leaves no two columns overlapping at %ipx', (screenPx) => {
    const railPx = screenPx - 40;
    const { columns } = layoutExamTimeline(
      [
        pt('EBC-MI', '2026-07-30T09:00'),
        pt('EBC-P', '2026-08-06T09:00'),
        pt('EBC-DS', '2026-08-10T09:00'),
        pt('EBC-MAN', '2026-08-12T09:00'),
        pt('EBC-ST', '2026-08-13T09:00'),
        pt('EBC-MT1', '2026-08-17T09:00'),
        pt('EBC-I', '2026-08-18T09:00'),
      ],
      now,
      railPx
    );
    const centresPx = columns.map((c) => (c.leftPct / 100) * railPx);
    for (let i = 1; i < centresPx.length; i++) {
      expect(centresPx[i]! - centresPx[i - 1]!).toBeGreaterThanOrEqual(minColumnFor(railPx));
    }
    expect(columns.reduce((n, c) => n + c.count, 0)).toBe(7);
  });

  it('spans a cluster range across months when it straddles one', () => {
    const { columns } = layoutExamTimeline(
      [pt('A', '2026-07-30T09:00'), pt('B', '2026-08-01T09:00'), pt('C', '2026-10-01T09:00')],
      now,
      WIDTH
    );
    expect(columns[0]!.subtitle).toBe('30.7.–1.8.');
  });

  // Columns are always drawn centred on their dot, so the span is inset by
  // half a column at each end — otherwise the first and last labels would
  // hang off the screen.
  it('insets the span so the end columns cannot overhang', () => {
    const { columns } = layoutExamTimeline(
      [pt('A', '2026-07-28T09:00'), pt('B', '2026-08-12T09:00'), pt('C', '2026-08-27T09:00')],
      now,
      WIDTH
    );
    const halfColumnPct = (minColumnFor(WIDTH) / 2 / WIDTH) * 100;
    expect(columns[0]!.leftPct).toBeCloseTo(halfColumnPct, 5);
    expect(columns[1]!.leftPct).toBeCloseTo(50, 5);
    expect(columns[2]!.leftPct).toBeCloseTo(100 - halfColumnPct, 5);
  });

  it('reports how far through the exam period today sits', () => {
    // First exam was 10 days ago, last is in 10 days → halfway.
    const { progressPct } = layoutExamTimeline(
      [pt('PAST', '2026-07-18T09:00'), pt('SOON', '2026-08-07T09:00')],
      now,
      WIDTH
    );
    expect(Math.round(progressPct)).toBe(50);
  });

  it('keeps progress at zero while every exam is still ahead', () => {
    const { progressPct } = layoutExamTimeline(
      [pt('A', '2026-08-07T09:00'), pt('B', '2026-08-27T09:00')],
      now,
      WIDTH
    );
    expect(progressPct).toBe(0);
  });

  it('collapses same-day exams into one cluster rather than dividing by zero', () => {
    const { columns } = layoutExamTimeline(
      [pt('A', '2026-08-10T09:00'), pt('B', '2026-08-10T14:00')],
      now,
      WIDTH
    );
    expect(columns).toHaveLength(1);
    expect(columns[0]!.count).toBe(2);
  });

  // First paint happens before the ResizeObserver reports a width; falling
  // back to even spacing keeps the rail sane instead of stacking every dot.
  it('falls back to even spacing before the width is known', () => {
    const { columns } = layoutExamTimeline(
      [pt('A', '2026-07-30T09:00'), pt('B', '2026-08-10T09:00'), pt('C', '2026-08-18T09:00')],
      now,
      0
    );
    expect(columns.map((c) => c.leftPct)).toEqual([0, 50, 100]);
    expect(columns.every((c) => c.count === 1)).toBe(true);
  });
});
