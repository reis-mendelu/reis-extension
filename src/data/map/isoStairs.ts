import { roomFrame } from './isoRoomFrame';

/**
 * Stairs a student can climb. Not `emergency_stairs`: Q's floor plan has them where there is no staircase
 * (the topmost ones beside Q45 on floor 4), so drawing them would send a student to a wall.
 */
export const isStairs = (type: string) => type === 'stairs';

/**
 * A stairwell drawn as what it is: a flight of steps, the treads laid across the stairwell's long side,
 * so a student reads "stairs" at a glance. Deliberately no arrow and no slope: nobody can say which floor
 * a student starts from, so the picture never says up or down. `ring` is [lng, lat]; the result is one
 * path of picture-pixel segments, at `heightM` above the ground, or '' when the room is too small to be a flight.
 */
export function stairTreads(ring: number[][], heightM: number): string {
  const frame = roomFrame(ring);
  if (!frame) return '';
  const { long: run, short: width } = frame;
  const length = run[1] - run[0];
  const span = width[1] - width[0];
  if (length < 2 || span < 1) return '';

  const n = Math.min(12, Math.max(4, Math.round(length / 0.55)));
  const inset = span * 0.08;
  return Array.from({ length: n }, (_, i) => {
    const r = run[0] + (length * (i + 0.5)) / n;
    return `M${frame.at(r, width[0] + inset, heightM)}L${frame.at(r, width[1] - inset, heightM)}`;
  }).join('');
}

/** An up-and-down arrow centred in a lift's footprint (picture pixels), as an SVG path: a lift has no steps to show it is one. */
export function liftArrow(ring: number[][]): string {
  const xs = ring.map((p) => p[0]!);
  const ys = ring.map((p) => p[1]!);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r =
    (Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2) * 0.6;
  const h = r * 0.45;
  const f = (n: number) => n.toFixed(1);
  return (
    `M${f(cx)} ${f(cy - r)}L${f(cx)} ${f(cy + r)}` +
    `M${f(cx - h)} ${f(cy - r + h)}L${f(cx)} ${f(cy - r)}L${f(cx + h)} ${f(cy - r + h)}` +
    `M${f(cx - h)} ${f(cy + r - h)}L${f(cx)} ${f(cy + r)}L${f(cx + h)} ${f(cy + r - h)}`
  );
}
