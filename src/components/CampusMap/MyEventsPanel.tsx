import { Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { sortByDate } from './eventHelpers';
import { isPastEvent, isScheduledEvent, goLiveDate } from './eventWindow';
import type { MapEvent } from '../../types/events';

function Row({ event, sub, onClick }: { event: MapEvent; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-base-200">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-base-content">{event.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-base-content/60">{sub}</span>
      </span>
    </button>
  );
}

// Society-mode side panel: the association's own events grouped by lifecycle, plus
// the Create entry point. Live = on the public map now; Scheduled = still hidden
// from students (goes live ~2 weeks out); Past = aged off the map (kept for the
// society). Rows fly the map to the event.
export function MyEventsPanel() {
  const events = useAppStore((s) => s.societyMapEvents);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const openComposer = useAppStore((s) => s.openComposer);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const past = sortByDate(events.filter((e) => isPastEvent(e.date))).reverse();
  const scheduled = sortByDate(events.filter((e) => isScheduledEvent(e.date)));
  const live = sortByDate(events.filter((e) => !isPastEvent(e.date) && !isScheduledEvent(e.date)));
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const section = (label: string, rows: MapEvent[], sub: (e: MapEvent) => string) =>
    rows.length > 0 && (
      <div>
        <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-base-content/60">{label}</div>
        {rows.map((e) => <Row key={e.id} event={e} sub={sub(e)} onClick={() => focusEvent(e.id, { fly: true })} />)}
      </div>
    );

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-bold">{t('map.myEvents')}</span>
        <button type="button" className="btn btn-primary btn-xs gap-1" onClick={() => openComposer()}>
          <Plus size={13} /> {t('map.createEvent')}
        </button>
      </div>
      <div className="overflow-y-auto">
        {section(t('map.liveNow'), live, (e) => fmt(e.date))}
        {section(t('map.scheduled'), scheduled, (e) => `${fmt(e.date)} · ${t('map.goesLive')} ${goLiveDate(e.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`)}
        {section(t('map.past'), past, (e) => fmt(e.date))}
        {events.length === 0 && <p className="px-3 py-6 text-center text-sm text-base-content/60">{t('map.noOwnEvents')}</p>}
      </div>
    </div>
  );
}
