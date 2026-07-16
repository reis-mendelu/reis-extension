import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { landmarkGroupLabels, roomLabel } from './mapHelpers';
import { EventDetailCard } from './EventDetailCard';
import landmarksJson from '../../data/map/landmarks.json';
import type { Landmark } from '../../types/campusMap';

const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const GROUP_LABELS = landmarkGroupLabels(LANDMARKS);
// For a selected landmark, the names of the OTHER places sharing its building
// (only FRRMS ↔ Kolej Akademie qualify — identical outline) so the panel makes
// the overlap explicit ("Z is also Kolej Akademie").
const COLOCATED = new Map<number, string[]>(
  LANDMARKS.map((l) => {
    const label = GROUP_LABELS.get(l.id);
    const others = LANDMARKS.filter((o) => o.id !== l.id && GROUP_LABELS.get(o.id) === label).map((o) => o.name);
    return [l.id, others];
  }),
);

export function DetailPanel() {
  const { t } = useTranslation();
  const sel = useAppStore((s) => s.mapSelection);
  if (!sel) return null;

  if (sel.kind === 'event') return <EventDetailCard event={sel.event} />;

  if (sel.kind === 'poi') {
    const p = sel.poi;
    const alsoHere = COLOCATED.get(p.id) ?? [];
    return (
      <div className="p-4 bg-base-100 border border-base-300 rounded-lg space-y-1">
        <h3 className="font-bold text-base-content">{p.name}</h3>
        <p className="text-sm text-base-content/60">{p.type}</p>
        {alsoHere.length > 0 && (
          <p className="text-sm text-base-content/70">{t('map.alsoHere')}: {alsoHere.join(', ')}</p>
        )}
        {p.url && <a className="link link-primary text-sm break-all" href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>}
        {p.phone && <p className="text-sm break-all">{p.phone}</p>}
        {p.email && <p className="text-sm break-all">{p.email}</p>}
        <p className="text-xs text-base-content/50 pt-2">{t('map.noFloorPlan')}</p>
      </div>
    );
  }

  const r = sel.kind === 'room' ? sel.room : null;
  const name = r
    ? roomLabel(r.name, r.passportNumber, r.nickname)
    : sel.kind === 'roomRef'
      ? roomLabel(sel.entry.name, sel.entry.code, sel.entry.nickname)
      : '';
  return (
    <div className="p-4 bg-base-100 border border-base-300 rounded-lg space-y-1">
      <h3 className="font-bold text-base-content">{name}</h3>
      {r && <p className="text-sm text-base-content/60">{r.label}</p>}
      {r?.seats != null && <p className="text-sm">{t('map.seats')}: {r.seats}</p>}
      {r?.hasProjector && <span className="badge badge-sm badge-info mr-1">{t('map.projector')}</span>}
      {r?.hasWhiteboard && <span className="badge badge-sm badge-info">{t('map.whiteboard')}</span>}
      {r?.passportNumber && <p className="text-xs text-base-content/50 pt-1">{r.passportNumber}</p>}
    </div>
  );
}
