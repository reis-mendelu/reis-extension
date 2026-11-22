import type { RoomFeature } from '../../../types/campusMap';
import { svgPath } from '../../../data/map/isoFloors';
import { categoryStyle } from '../mapHelpers';

/** One room of the open floor, as a path in picture pixels; the selected one in the 2D map's orange. */
export function RoomShape({
  f,
  ring,
  selected,
}: {
  f: RoomFeature;
  ring: [number, number][];
  selected: boolean;
}) {
  const struct = f.properties.category === 'structure';
  const st = categoryStyle(f.properties.category, f.properties.type);
  return (
    <path
      d={svgPath([ring])}
      fill={selected ? '#fb923c' : struct ? '#e3e6ea' : st.fill}
      fillOpacity={selected ? 0.95 : struct ? 0.5 : 0.75}
      stroke={selected ? '#ea580c' : struct ? '#c2c8d0' : st.stroke}
      strokeWidth={selected ? 3 : 1}
      vectorEffect="non-scaling-stroke"
    />
  );
}
