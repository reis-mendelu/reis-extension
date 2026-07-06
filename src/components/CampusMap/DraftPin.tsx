import { MapPin } from 'lucide-react';

// The in-progress event location, shown while the composer is open and a point
// has been placed. Distinct from saved EventPins (which are white emoji discs):
// a filled, society-coloured teardrop with a pulsing halo so a freshly-placed
// point is unmistakable on the map. Clicking it re-enters placing mode so the
// society can nudge the location. (x, y) is a Leaflet LAYER point, exactly like
// EventPin, so it rides pans/zooms with the basemap.
export function DraftPin({
  x,
  y,
  color,
  label,
  onClick,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="pointer-events-auto absolute left-0 top-0 flex items-center justify-center leaflet-zoom-animated"
      style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -100%)` }}
      title={label}
      aria-label={label}
      data-draft-pin="true"
      onClick={onClick}
    >
      <span
        className="absolute -z-10 rounded-full motion-safe:animate-ping"
        style={{ width: 34, height: 34, backgroundColor: color, opacity: 0.35, bottom: 2 }}
      />
      <span
        className="flex items-center justify-center rounded-full ring-2 ring-white"
        style={{
          width: 30,
          height: 30,
          backgroundColor: color,
          boxShadow: '0 2px 6px rgba(0,0,0,.35)',
        }}
      >
        <MapPin size={17} color="#fff" strokeWidth={2.5} />
      </span>
    </button>
  );
}
