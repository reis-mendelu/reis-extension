import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function DetailPanel() {
  const { t } = useTranslation();
  const sel = useAppStore((s) => s.mapSelection);
  if (!sel) return null;

  if (sel.kind === 'poi') {
    const p = sel.poi;
    return (
      <div className="p-4 bg-base-100 border border-base-300 rounded-lg space-y-1">
        <h3 className="font-bold text-base-content">{p.name}</h3>
        <p className="text-sm text-base-content/60">{p.type}</p>
        {p.url && <a className="link link-primary text-sm" href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>}
        {p.phone && <p className="text-sm">{p.phone}</p>}
        {p.email && <p className="text-sm">{p.email}</p>}
        <p className="text-xs text-base-content/50 pt-2">{t('map.noFloorPlan')}</p>
      </div>
    );
  }

  const r = sel.kind === 'room' ? sel.room : null;
  const name = r ? (r.passportNumber ?? r.name) : sel.kind === 'roomRef' ? sel.entry.code : '';
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
