import { useEffect, useRef, useState } from 'react';
import { Building2, Check, MapPin, Search } from 'lucide-react';
import roomsIndexJson from '../../data/map/rooms-index.json';
import buildingsJson from '../../data/map/buildings.json';
import { roomCodeToCoord, roomLabel, searchRooms } from './mapHelpers';
import { searchPlaces, type PlaceResult } from '../../api/placeSearch';
import type { RoomIndexEntry, BuildingsMeta } from '../../types/campusMap';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const BUILDINGS = buildingsJson as BuildingsMeta;
const DEBOUNCE_MS = 300;
/** Rooms shown above the town results — enough to find a hall, few enough
 *  that the places below stay on screen. */
const MAX_ROOMS = 5;

type Coord = [number, number];

/**
 * Where the event is, as ONE question. It replaced a "Kampus / Ve městě" toggle
 * with a separate search behind each side: a society had to decide which kind of
 * venue it had before it could type it. Now it types, and campus rooms (the
 * local index, instant) list above places in town (Photon, debounced) — the
 * kind follows from the pick. Dropping the pin by hand stays as the fallback for
 * a venue neither knows.
 *
 * Event-driven fetching only: the one effect is the debounce timer's cleanup.
 */
export function ComposerVenueSearch({
  selected,
  onSelectRoom,
  onSelectPlace,
  onClear,
  onPickOnMap,
  t,
}: {
  /** Display name of the chosen venue, or null while none is chosen. */
  selected: string | null;
  onSelectRoom: (sel: { code: string; name: string; coord: Coord }) => void;
  onSelectPlace: (sel: { name: string; coord: Coord }) => void;
  onClear: () => void;
  onPickOnMap: () => void;
  t: (k: string) => string;
}) {
  const [q, setQ] = useState('');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id so a slow earlier response can't overwrite a later one.
  const seq = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
        <Check size={14} className="text-success" />
        <span className="min-w-0 flex-1 truncate">{selected}</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClear}>
          {t('map.changePlace')}
        </button>
      </div>
    );
  }

  const onChange = (val: string) => {
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    timer.current = setTimeout(() => {
      void searchPlaces(trimmed).then((r) => {
        if (mine !== seq.current) return; // a newer keystroke already fired
        setPlaces(r);
        setLoading(false);
      });
    }, DEBOUNCE_MS);
  };

  const rooms = q.trim()
    ? searchRooms(q, INDEX)
        .map((r) => ({ r, coord: roomCodeToCoord(r.code, INDEX, BUILDINGS) }))
        .filter((x): x is { r: RoomIndexEntry; coord: Coord } => !!x.coord)
        .slice(0, MAX_ROOMS)
    : [];
  const searched = q.trim().length >= 2;
  const nothing = searched && !loading && rooms.length === 0 && places.length === 0;
  const group = 'px-2 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wide opacity-60';
  const hit = 'flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-base-200';

  return (
    <div>
      <label className="input input-bordered flex w-full items-center gap-2">
        <Search size={15} className="opacity-60" />
        <input
          className="grow"
          placeholder={t('map.searchVenue')}
          value={q}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      </label>
      {(rooms.length > 0 || searched) && (
        <div className="mt-1 flex max-h-56 flex-col overflow-y-auto">
          {rooms.length > 0 && <div className={group}>{t('map.venueCampus')}</div>}
          {rooms.map(({ r, coord }) => {
            const label = roomLabel(r.name, r.code, r.nickname);
            return (
              <button
                key={r.code}
                type="button"
                className={hit}
                onClick={() => onSelectRoom({ code: r.code, name: label, coord })}
              >
                <Building2 size={13} className="shrink-0 opacity-60" />
                <span className="font-semibold">{label}</span>
                <span className="truncate text-[11px] text-base-content/50">{r.code}</span>
              </button>
            );
          })}
          {places.length > 0 && <div className={group}>{t('map.venueOffcampus')}</div>}
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              className={hit}
              onClick={() => onSelectPlace({ name: p.name, coord: p.coord })}
            >
              <MapPin size={13} className="shrink-0 opacity-60" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                {p.context && (
                  <span className="block truncate text-[11px] text-base-content/50">
                    {p.context}
                  </span>
                )}
              </span>
            </button>
          ))}
          {searched && loading && places.length === 0 && (
            <p className="px-2 py-2 text-center text-xs text-base-content/50">
              {t('map.searching')}
            </p>
          )}
          {nothing && (
            <p className="px-2 py-3 text-center text-xs text-base-content/50">
              {t('map.noPlaceFound')}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-xs mt-1 w-full gap-1.5 text-base-content/60"
        onClick={onPickOnMap}
      >
        <MapPin size={13} /> {t('map.orPickOnMap')}
      </button>
    </div>
  );
}
