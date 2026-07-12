import { useEffect, useRef, useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import { searchPlaces, type PlaceResult } from '../../api/placeSearch';

// Off-campus venue picker: search-as-you-type against Photon (OSM) so a society
// can type "Bar, který neexistuje" and pick the pin, instead of hunting for the
// spot on the map. Mirrors ComposerRoomSearch's shape (input → dropdown →
// selected chip); the fetch is debounced and event-driven (not a data-fetching
// useEffect — the only effect here is unmount cleanup of the debounce timer).
const DEBOUNCE_MS = 300;

export function ComposerPlaceSearch({
  selected,
  onSelect,
  onClear,
  t,
}: {
  selected: { name: string } | null;
  onSelect: (sel: { name: string; coord: [number, number] }) => void;
  onClear: () => void;
  t: (k: string) => string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
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
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
        <Check size={14} className="text-success" />
        <span className="min-w-0 flex-1 truncate">{selected.name}</span>
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
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    timer.current = setTimeout(() => {
      void searchPlaces(trimmed).then((r) => {
        if (mine !== seq.current) return; // a newer keystroke already fired
        setResults(r);
        setLoading(false);
      });
    }, DEBOUNCE_MS);
  };

  return (
    <div className="mt-2">
      <label className="input input-bordered flex items-center gap-2">
        <Search size={15} className="opacity-60" />
        <input
          className="grow"
          placeholder={t('map.searchPlace')}
          value={q}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      </label>
      {q.trim().length >= 2 && (
        <div className="mt-1 flex max-h-40 flex-col overflow-y-auto">
          {loading && results.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-base-content/50">
              {t('map.searching')}
            </p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-base-content/50">
              {t('map.noPlaceFound')}
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-base-200"
              onClick={() => onSelect({ name: r.name, coord: r.coord })}
            >
              <MapPin size={13} className="flex-shrink-0 opacity-60" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.name}</span>
                {r.context && (
                  <span className="block truncate text-[11px] text-base-content/50">
                    {r.context}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
