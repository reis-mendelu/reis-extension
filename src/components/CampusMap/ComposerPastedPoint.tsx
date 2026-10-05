import { MapPin } from 'lucide-react';
import type { ParsedPoint } from './parseCoordinate';

type Coord = [number, number];

/**
 * The one hit the venue search shows for pasted coordinates or a maps link.
 * A link that names its place picks it as a place, so the event keeps the
 * name; a bare coordinate picks it as a point, like a hand-dropped pin.
 */
export function ComposerPastedPoint({
  point,
  className,
  onSelectPlace,
  onSelectPoint,
  t,
}: {
  point: ParsedPoint;
  className: string;
  onSelectPlace: (sel: { name: string; coord: Coord }) => void;
  onSelectPoint: (coord: Coord) => void;
  t: (k: string) => string;
}) {
  const { name, coord } = point;
  return (
    <button
      type="button"
      className={className}
      onClick={() => (name ? onSelectPlace({ name, coord }) : onSelectPoint(coord))}
    >
      <MapPin size={13} className="shrink-0 opacity-60" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name ?? t('map.useThisPoint')}</span>
        <span className="block truncate text-[11px] text-base-content/50">
          {coord[1].toFixed(5)}, {coord[0].toFixed(5)}
        </span>
      </span>
    </button>
  );
}
