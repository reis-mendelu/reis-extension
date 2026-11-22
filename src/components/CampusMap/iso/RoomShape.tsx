import type { RoomFeature } from '../../../types/campusMap';
import { svgPath } from '../../../data/map/isoFloors';
import { categoryStyle } from '../mapHelpers';

/** One room of the open floor, as a path in picture pixels; the selected one in the 2D map's orange. */
export function RoomShape({
  f,
  ring,
  selected,
  treads = '',
  guide = false,
}: {
  f: RoomFeature;
  ring: [number, number][];
  selected: boolean;
  /** A stairwell's steps, as a path of segments (isoStairs.ts); empty for every other room. */
  treads?: string;
  /** The stairs to climb for the picked room: lit and pulsing as a wave along the flight. */
  guide?: boolean;
}) {
  const struct = f.properties.category === 'structure';
  const st = categoryStyle(f.properties.category, f.properties.type);
  // Each step on its own, the lowest on the screen first, so the pulse runs up the flight as a wave.
  const steps = guide
    ? treads
        .split('M')
        .filter(Boolean)
        .map((d) => `M${d}`)
        .sort((a, b) => stepY(b) - stepY(a))
    : [];
  return (
    <>
      <path
        d={svgPath([ring])}
        fill={selected ? '#fb923c' : guide ? '#bfdbfe' : struct ? '#e3e6ea' : st.fill}
        fillOpacity={selected ? 0.95 : struct ? 0.5 : guide ? 0.95 : 0.75}
        stroke={selected ? '#ea580c' : guide ? '#2563eb' : struct ? '#c2c8d0' : st.stroke}
        strokeWidth={selected ? 3 : guide ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
      {guide && (
        <g
          data-testid="iso-treads"
          data-guide="true"
          fill="none"
          stroke="#1d4ed8"
          strokeLinecap="round"
        >
          {steps.map((d, i) => (
            <path
              key={d}
              d={d}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              className="motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </g>
      )}
      {treads && !guide && (
        <path
          data-testid="iso-treads"
          d={treads}
          fill="none"
          stroke={selected ? '#9a3412' : '#7c5a2a'}
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </>
  );
}

/** The y of a step's first end, in picture pixels (a step is `M x y L x y`). */
const stepY = (d: string) => Number(/ (-?[\d.]+)L/.exec(d)?.[1]);
