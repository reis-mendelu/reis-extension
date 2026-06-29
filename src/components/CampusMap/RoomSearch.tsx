import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function RoomSearch() {
  const { t } = useTranslation();
  const query = useAppStore((s) => s.mapSearchQuery);
  const results = useAppStore((s) => s.mapSearchResults);
  const setQuery = useAppStore((s) => s.setMapSearchQuery);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const focusPoiById = useAppStore((s) => s.focusPoiById);
  const focusLandmarkById = useAppStore((s) => s.focusLandmarkById);

  return (
    <div className="relative w-64">
      <input className="input input-sm input-bordered w-full" value={query} placeholder={t('map.searchPlaceholder')}
        onChange={(e) => setQuery(e.target.value)} />
      {results.length > 0 && (
        <ul className="absolute z-[1000] mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-md max-h-64 overflow-auto">
          {results.map((m, i) => {
            const label = m.kind === 'poi' ? m.poi.name : m.kind === 'roomRef' ? m.entry.name : m.kind === 'landmark' ? m.landmark.name : '';
            return (
              <li key={i}>
                <button className="w-full text-left px-3 py-1.5 hover:bg-base-200 text-sm"
                  onClick={() => { if (m.kind === 'poi') focusPoiById(m.poi.id);
                    else if (m.kind === 'roomRef') focusRoomByCode(m.entry.code);
                    else if (m.kind === 'landmark') focusLandmarkById(m.landmark.id); setQuery(''); }}>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
