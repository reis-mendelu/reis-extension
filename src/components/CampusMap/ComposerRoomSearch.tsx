import { useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import roomsIndexJson from '../../data/map/rooms-index.json';
import buildingsJson from '../../data/map/buildings.json';
import { roomCodeToCoord } from './mapHelpers';
import type { RoomIndexEntry, BuildingsMeta } from '../../types/campusMap';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const BUILDINGS = buildingsJson as BuildingsMeta;

export function ComposerRoomSearch({
  selected,
  onSelect,
  onClear,
  t,
}: {
  selected: { code: string; name: string } | null;
  onSelect: (sel: { code: string; name: string; coord: [number, number] }) => void;
  onClear: () => void;
  t: (k: string) => string;
}) {
  const [q, setQ] = useState('');

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

  const ql = q.trim().toLowerCase();
  const matches = ql
    ? INDEX.filter(
        (r) => r.code.toLowerCase().includes(ql) || r.name.toLowerCase().includes(ql)
      ).slice(0, 6)
    : [];

  return (
    <div className="mt-2">
      <label className="input input-bordered flex items-center gap-2">
        <Search size={15} className="opacity-60" />
        <input
          className="grow"
          placeholder={t('map.searchRoom')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </label>
      {ql && (
        <div className="mt-1 flex max-h-40 flex-col overflow-y-auto">
          {matches.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-base-content/50">
              {t('map.noRoomFound')}
            </p>
          )}
          {matches.map((r) => {
            const coord = roomCodeToCoord(r.code, INDEX, BUILDINGS);
            if (!coord) return null;
            return (
              <button
                key={r.code}
                type="button"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-base-200"
                onClick={() => onSelect({ code: r.code, name: r.name, coord })}
              >
                <MapPin size={13} className="flex-shrink-0 opacity-60" />
                <span className="font-semibold">{r.name}</span>
                <span className="truncate text-[11px] text-base-content/50">{r.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
