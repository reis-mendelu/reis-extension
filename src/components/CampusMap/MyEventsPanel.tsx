import { LogOut, Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { sortByDate } from './eventHelpers';
import { isPastEvent, isScheduledEvent, goLiveDate } from './eventWindow';
import { societyById } from '../../data/societies';
import { EventRow } from './EventRow';
import { EventComposer } from './EventComposer';
import type { MapEvent } from '../../types/events';

// Society-mode side panel: the association's own events grouped by lifecycle,
// the Create entry point, an inline composer (create/edit, hosted at the top
// rather than as an overlay), and a logout button. Live = on the public map
// now; Scheduled = still hidden from students (goes live ~2 weeks out); Past =
// aged off the map (kept for the society). Rows fly the map to the event. Rows
// reuse the same EventRow as the public Events tab for a consistent look.
export function MyEventsPanel() {
  const events = useAppStore((s) => s.societyMapEvents);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const openComposer = useAppStore((s) => s.openComposer);
  const composerOpen = useAppStore((s) => s.composerOpen);
  const editEventId = useAppStore((s) => s.editEventId);
  const closeComposer = useAppStore((s) => s.closeComposer);
  const adminLogout = useAppStore((s) => s.adminLogout);
  const assocId = useAppStore((s) => s.adminAssociationId);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const soc = assocId ? societyById(assocId) : null;

  const past = sortByDate(events.filter((e) => isPastEvent(e.date))).reverse();
  const scheduled = sortByDate(events.filter((e) => isScheduledEvent(e.date)));
  const live = sortByDate(events.filter((e) => !isPastEvent(e.date) && !isScheduledEvent(e.date)));
  const goLive = (e: MapEvent) => `${t('map.goesLive')} ${goLiveDate(e.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;

  const section = (label: string, rows: MapEvent[], subline?: (e: MapEvent) => string) =>
    rows.length > 0 && (
      <div>
        <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-base-content/60">{label}</div>
        {rows.map((e) => (
          <EventRow key={e.id} event={e} locale={locale} t={t} selected={false} subline={subline?.(e)} onClick={() => focusEvent(e.id, { fly: true })} />
        ))}
      </div>
    );

  return (
    <div className="flex max-h-[80vh] flex-col">
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: soc?.color ?? 'var(--fallback-p,#0046a0)' }}>
          {soc?.shortName?.slice(0, 2).toUpperCase() ?? '•'}
        </span>
        <span className="text-sm font-bold">{soc?.name ?? t('map.myEvents')}</span>
        <button type="button" className="btn btn-primary btn-xs ml-auto gap-1" onClick={() => openComposer()}>
          <Plus size={13} /> {t('map.createEvent')}
        </button>
      </div>

      {composerOpen && <EventComposer key={editEventId ?? 'new'} onDone={closeComposer} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section(t('map.liveNow'), live)}
        {section(t('map.scheduled'), scheduled, goLive)}
        {section(t('map.past'), past)}
        {events.length === 0 && <p className="px-3 py-6 text-center text-sm text-base-content/60">{t('map.noOwnEvents')}</p>}
      </div>

      <div className="border-t border-base-300 px-3 py-2">
        <button type="button" className="btn btn-ghost btn-xs gap-1.5 text-base-content/60" onClick={() => void adminLogout()}>
          <LogOut size={13} /> {t('admin.logout')}
        </button>
      </div>
    </div>
  );
}
