import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { sortByDate } from '../CampusMap/eventHelpers';
import { isPastEvent, isScheduledEvent, goLiveDate } from '../CampusMap/eventWindow';
import { deletePost } from '../../api/societyPosts';
import { EventRow } from '../CampusMap/EventRow';
import { EventComposer } from '../CampusMap/EventComposer';
import type { MapEvent } from '../../types/events';

// The console's list column: the active society's events grouped by lifecycle,
// the Create entry point, and an inline composer that takes the column over
// while open. Live = on the public map now; Scheduled = still hidden from
// students (goes live ~2 weeks out); Past = aged off the map but kept for the
// society. Rows fly the console's map to the event.
//
// Was MyEventsPanel, which lived inside the student map's side panel. The
// society identity moved to AdminConsoleHeader, which is also where the picker
// lives, so this file no longer knows which society it is showing.
export function AdminEventList() {
  const events = useAppStore((s) => s.societyMapEvents);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const openComposer = useAppStore((s) => s.openComposer);
  const composerOpen = useAppStore((s) => s.composerOpen);
  const editEventId = useAppStore((s) => s.editEventId);
  const closeComposer = useAppStore((s) => s.closeComposer);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const reloadMapEvents = useAppStore((s) => s.reloadMapEvents);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const selection = useAppStore((s) => s.mapSelection);
  const activeId = useAppStore((s) => s.adminActiveAssociationId);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  // Delete is a two-step, in-row confirm so authoring never leaves this column:
  // the trash icon arms `confirmId`, then a check commits. `busyId` disables the
  // row while the request is in flight.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await deletePost(id);
      if (res.error) {
        toast.error(t('admin.saveError'));
        return;
      }
      if (selectedId === id) clearMapSelection(); // drop the highlight if it was on this row
      await loadSocietyPosts();
      void reloadMapEvents(); // drop the pin from the public "Akce" feed too
      toast.success(t('map.toastDeleted'));
    } catch {
      toast.error(t('admin.saveError'));
    } finally {
      // Cleared in finally so an unexpected throw never leaves the row stuck
      // disabled / mid-confirm.
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const rowActions = (e: MapEvent) =>
    confirmId === e.id ? (
      <>
        <button
          type="button"
          className="btn btn-ghost btn-xs px-1.5 text-error"
          aria-label={t('map.deleteConfirm')}
          disabled={busyId === e.id}
          onClick={() => void remove(e.id)}
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs px-1.5"
          aria-label={t('common.cancel')}
          onClick={() => setConfirmId(null)}
        >
          <X size={15} />
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          className="btn btn-ghost btn-xs px-1.5 text-base-content/45 hover:text-base-content"
          aria-label={t('map.edit')}
          onClick={() => openComposer(e.id)}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs px-1.5 text-base-content/45 hover:text-error"
          aria-label={t('map.delete')}
          onClick={() => setConfirmId(e.id)}
        >
          <Trash2 size={14} />
        </button>
      </>
    );

  const past = sortByDate(events.filter((e) => isPastEvent(e.date))).reverse();
  const scheduled = sortByDate(events.filter((e) => isScheduledEvent(e.date)));
  const live = sortByDate(events.filter((e) => !isPastEvent(e.date) && !isScheduledEvent(e.date)));
  const goLive = (e: MapEvent) =>
    `${t('map.goesLive')} ${goLiveDate(e.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;

  const section = (label: string, rows: MapEvent[], subline?: (e: MapEvent) => string) =>
    rows.length > 0 && (
      <div>
        <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
          {label}
        </div>
        {rows.map((e) => (
          <EventRow
            key={e.id}
            event={e}
            locale={locale}
            t={t}
            selected={selectedId === e.id}
            subline={subline?.(e)}
            onClick={() => focusEvent(e.id, { fly: true })}
            actions={rowActions(e)}
          />
        ))}
      </div>
    );

  // A reIS admin arrives with no society picked. Authoring is meaningless until
  // one is chosen, so the column says so rather than showing an empty list that
  // looks like a society with no events.
  if (!activeId) {
    return (
      <p className="px-4 py-8 text-center text-sm text-base-content/60">
        {t('admin.pickSocietyPrompt') as string}
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Hidden while composing: the composer has its own header, and the
          column is narrow enough that the extra bar costs real height. */}
      {!composerOpen && (
        <div className="flex items-center border-b border-base-300 px-3 py-2.5">
          <button
            type="button"
            className="btn btn-primary btn-sm ml-auto gap-1"
            onClick={() => openComposer()}
          >
            <Plus size={14} /> {t('map.createEvent') as string}
          </button>
        </div>
      )}

      {/* One scroll area: the composer takes it over while open (sole focus),
          otherwise it lists the society's events. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {composerOpen ? (
          <EventComposer key={editEventId ?? 'new'} onDone={closeComposer} />
        ) : (
          <>
            {section(t('map.liveNow'), live)}
            {section(t('map.scheduled'), scheduled, goLive)}
            {section(t('map.past'), past)}
            {events.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-base-content/60">
                {t('map.noOwnEvents') as string}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
