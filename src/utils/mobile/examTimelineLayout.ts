import type { TimelinePoint } from './examTimeline';

export interface TimelineColumn {
  id: string;
  /** Position along the rail, 0–100. Every column is drawn centred on this,
   *  which is only safe because the date span is mapped into an inset range
   *  (half a column in from each end) — see `layoutExamTimeline`. */
  leftPct: number;
  /** How many exams this column stands for; > 1 means a cluster. */
  count: number;
  /** Subject code, or "3×" for a cluster. */
  title: string;
  /** "10.8.", or "10.–13.8." for a cluster. */
  subtitle: string;
}

export interface TimelineLayout {
  columns: TimelineColumn[];
  /** How far through the exam period today sits, 0–100. Zero while every
   *  exam is still ahead. */
  progressPct: number;
}

/**
 * Narrowest a label column may be before its neighbour has to merge in: a fifth
 * of the rail, bounded to 58–72px.
 *
 * 72 covers the widest label either kind of column produces — a cluster's
 * "2×17.–18.8." beats a plain "EBC-MT1 / 17.8." — but holding 72 on a 320px
 * screen left room for only two columns and collapsed six exams into a single
 * "6×" blob. Scaling keeps a narrow screen readable without letting a wide one
 * crowd.
 */
export function minColumnFor(widthPx: number): number {
  return Math.max(58, Math.min(72, widthPx / 5));
}

/** Midnight of the day `d` falls on — the rail is scaled in days, so times of
 *  day must not nudge a dot's position. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function shortDate(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** "10.–13.8." within one month, "30.7.–1.8." across two. */
function rangeLabel(from: Date, to: Date): string {
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()}.–${shortDate(to)}`;
  }
  return `${shortDate(from)}–${shortDate(to)}`;
}

function column(members: TimelinePoint[], leftPct: number): TimelineColumn {
  const first = members[0]!;
  const last = members[members.length - 1]!;
  return {
    id: first.id,
    leftPct,
    count: members.length,
    title: members.length === 1 ? first.subjectCode : `${members.length}×`,
    subtitle: members.length === 1 ? first.shortLabel : rangeLabel(first.date, last.date),
  };
}

/** Even index spacing — the pre-measurement fallback, and what a zero-length
 *  span (every exam on one day, or a single exam) degrades to. */
function evenlySpaced(points: TimelinePoint[]): TimelineColumn[] {
  const last = points.length - 1;
  return points.map((p, i) => column([p], last === 0 ? 50 : (i / last) * 100));
}

/**
 * Lays registered exams along the rail **by date**, so the spacing means
 * something: four exams spread over a month and four crammed into one week no
 * longer render identically. Exams too close together to fit side by side merge
 * into a single "N×" column rather than overlapping — which is what the old
 * index-spaced version did from the fifth exam onwards.
 *
 * The span runs from the earlier of today / the first exam to the last exam, so
 * `progressPct` reads as "how far through the exam period am I" and sits at
 * zero while everything is still ahead.
 *
 * @param points     Registered terms, ascending by date (buildExamTimeline's order).
 * @param now        Injected rather than read from the clock, so this stays pure.
 * @param widthPx    Measured rail width. 0 (not yet measured) falls back to even spacing.
 * @param minColumnPx See `minColumnFor` — overridable for tests.
 */
export function layoutExamTimeline(
  points: TimelinePoint[],
  now: Date,
  widthPx: number,
  minColumnPx = minColumnFor(widthPx)
): TimelineLayout {
  if (points.length === 0) return { columns: [], progressPct: 0 };
  if (widthPx <= 0 || points.length === 1) {
    return { columns: evenlySpaced(points), progressPct: 0 };
  }

  const start = Math.min(startOfDay(now), startOfDay(points[0]!.date));
  const end = startOfDay(points[points.length - 1]!.date);
  const spanMs = end - start;
  // Every exam on the same day: there is no span to scale against, so they
  // all belong to one cluster rather than one division by zero.
  if (spanMs <= 0) return { columns: [column(points, 50)], progressPct: 0 };

  // Dates map into an INSET range — half a column in from each end — rather
  // than the full rail. That keeps every column centred on its dot without
  // any of them overhanging the screen, so the spacing the clustering
  // enforces below is also the spacing that renders. (Anchoring the end
  // columns by their outer edge instead moved them inward by a full column
  // width, silently halving the gap the clustering had just guaranteed.)
  const half = minColumnPx / 2;
  const usablePx = Math.max(0, widthPx - minColumnPx);
  const xOf = (d: Date) => half + ((startOfDay(d) - start) / spanMs) * usablePx;
  const midOf = (members: TimelinePoint[]) =>
    members.reduce((sum, p) => sum + xOf(p.date), 0) / members.length;

  // Merge the closest adjacent pair until every column is at least one column
  // width from its neighbour. A single left-to-right sweep is not enough: a
  // column is drawn centred on its members' MIDPOINT, which drifts right as
  // the group grows, so measuring the next point against the group's first
  // member leaves real overlaps behind (seen at 320px). Repeating until the
  // invariant holds is the only thing that guarantees no collision.
  let groups: TimelinePoint[][] = points.map((p) => [p]);
  for (;;) {
    let closest = -1;
    let smallestGap = minColumnPx;
    for (let i = 1; i < groups.length; i++) {
      const gap = midOf(groups[i]!) - midOf(groups[i - 1]!);
      if (gap < smallestGap) {
        smallestGap = gap;
        closest = i;
      }
    }
    if (closest === -1) break;
    groups = groups
      .map((g, i) => (i === closest - 1 ? [...g, ...groups[closest]!] : g))
      .filter((_, i) => i !== closest);
  }

  const columns = groups.map((members) => column(members, (midOf(members) / widthPx) * 100));

  const elapsed = ((startOfDay(now) - start) / spanMs) * 100;
  return { columns, progressPct: Math.min(100, Math.max(0, elapsed)) };
}
