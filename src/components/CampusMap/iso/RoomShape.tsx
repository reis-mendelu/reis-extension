import type { RoomFeature } from '../../../types/campusMap';
import { svgPath } from '../../../data/map/isoFloors';
import { categoryStyle } from '../mapHelpers';
import { liftArrow } from '../../../data/map/isoStairs';

/** One room of the open floor, as a path in picture pixels; the selected one in the 2D map's orange. */
export function RoomShape({
  f,
  ring,
  selected,
  treads = '',
}: {
  f: RoomFeature;
  ring: [number, number][];
  selected: boolean;
  /** A stairwell's steps, as a path of segments (isoStairs.ts); empty for every other room. */
  treads?: string;
}) {
  const struct = f.properties.category === 'structure';
  const st = categoryStyle(f.properties.category, f.properties.type);
  return (
    <>
      <path
        d={svgPath([ring])}
        fill={selected ? '#fb923c' : struct ? '#e3e6ea' : st.fill}
        fillOpacity={selected ? 0.95 : struct ? 0.5 : 0.75}
        stroke={selected ? '#ea580c' : struct ? '#c2c8d0' : st.stroke}
        strokeWidth={selected ? 3 : 1}
        vectorEffect="non-scaling-stroke"
      />
      {f.properties.type === 'elevator' && (
        <path
          data-testid="iso-lift"
          d={liftArrow(ring)}
          fill="none"
          stroke={selected ? '#9a3412' : '#7c5a2a'}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {treads && (
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
