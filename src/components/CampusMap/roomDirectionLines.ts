import { floorText } from './floorText';
import type { Step } from '../../utils/indoor/roomDirections';

type T = (key: string, params?: Record<string, string | number>) => string;

/** One step as the card shows it: what to look for, and where. */
export interface DirectionLine {
  kind: 'enter' | 'up' | 'down' | 'arrive';
  primary: string;
  secondary: string;
}

const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function stairs(step: Extract<Step, { kind: 'core' }>, t: T): string {
  const side = t(`map.directions.side.${step.side}`);
  return t(step.lift ? 'map.directions.stairsOrLift' : 'map.directions.stairs', { side });
}

/** The steps in words: the entrance, the floor change by its staircase, the room. */
export function directionLines(steps: Step[], t: T): DirectionLine[] {
  return steps.map((step): DirectionLine => {
    if (step.kind === 'enter')
      return {
        kind: 'enter',
        primary: capitalised(
          t('map.directions.enter', { side: t(`map.directions.side.${step.side}`) })
        ),
        secondary: floorText(step.level, t),
      };
    if (step.kind === 'core')
      return {
        kind: step.direction,
        primary: t(`map.directions.${step.direction}`, { floor: floorText(step.level, t) }),
        secondary: stairs(step, t),
      };
    const floor = floorText(step.level, t);
    return {
      kind: 'arrive',
      primary: step.name,
      secondary: step.byCore ? `${floor} · ${t('map.directions.byStairs')}` : floor,
    };
  });
}

/** The way on one line, for the closed sheet: the entrance, then the staircase. */
export function directionSummary(steps: Step[], t: T): string {
  const [enter, next] = directionLines(steps, t);
  if (!enter) return '';
  if (!next || next.kind === 'arrive') return `${enter.primary} · ${enter.secondary}`;
  return `${enter.primary} · ${next.kind === 'up' ? '↑' : '↓'} ${next.secondary}`;
}
