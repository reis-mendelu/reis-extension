import type { MapEvent } from '../../types/events';
import type { Society } from '../../types/events';

// Top band of the event detail card: the poster (or a society-colour wash) with
// the hosting society's logo avatar overlapping the bottom-left edge, the way a
// Facebook / Luma event header reads. The avatar establishes "who's hosting"
// before the eye reaches the host chip below.
export function EventDetailCover({ event, society }: { event: MapEvent; society: Society }) {
  return (
    <div className="relative h-24">
      {event.imageUrl ? (
        <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" style={{ backgroundColor: society.color }} />
      )}
      {/* soft fade so the avatar + any text stay legible over busy posters */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
      <div
        className="absolute -bottom-5 left-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full ring-2 ring-base-100"
        style={{ backgroundColor: society.color }}
      >
        {society.logo ? (
          <img src={society.logo} alt={society.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-extrabold text-white">{society.glyph}</span>
        )}
      </div>
    </div>
  );
}
