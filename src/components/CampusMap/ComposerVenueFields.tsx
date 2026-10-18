import { MapPin } from 'lucide-react';
import { ComposerVenueSearch } from './ComposerVenueSearch';
import { ComposerPlaceNameField } from './ComposerPlaceNameField';
import type { useVenuePicker } from './useVenuePicker';

const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

/**
 * Where the event is: the venue search, the phone's "show on map" and the
 * name for a hand-dropped pin. Split out of EventComposer, which hides the
 * whole block for a notice (it has no place), and to keep that file in budget.
 */
export function ComposerVenueFields({
  venue,
  t,
}: {
  venue: ReturnType<typeof useVenuePicker>;
  t: (k: string) => string;
}) {
  const { room, placeName, coord } = venue;
  const venueName = room?.name ?? placeName ?? (coord ? t('map.mapPoint') : null);
  return (
    <>
      <label className={LABEL}>{t('map.venueLabel')}</label>
      <ComposerVenueSearch
        selected={venueName}
        onSelectRoom={venue.pickRoom}
        onSelectPlace={venue.pickPlace}
        onSelectPoint={venue.pickPoint}
        onClear={venue.clearVenue}
        onPickOnMap={venue.pickOnMap}
        t={t}
      />
      {venue.isPhone && coord && (
        <button
          type="button"
          className="btn btn-ghost btn-xs mt-1.5 w-full gap-1.5 text-base-content/70"
          onClick={venue.previewDraftOnMap}
        >
          <MapPin size={13} /> {t('map.showOnMap')}
        </button>
      )}
      {coord && !room && (
        <ComposerPlaceNameField value={venue.placeNameField} onChange={venue.setTypedName} t={t} />
      )}
    </>
  );
}
