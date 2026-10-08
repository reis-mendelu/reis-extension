import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { sortByDate } from '../CampusMap/eventHelpers';
import { isFinishedEvent, hasFinished } from '../CampusMap/eventWindow';
import { eventWhenLabel } from '../CampusMap/eventHelpers';
import { deletePost } from '../../api/societyPosts';
import { EventRow } from '../CampusMap/EventRow';
import { EventComposer } from '../CampusMap/EventComposer';
import { EventStats, EventStatsNote } from './EventStats';
import { AdminEventRowActions } from './AdminEventRowActions';
import type { MapEvent } from '../../types/events';

// The console's list column: the active society's events grouped by lifecycle,
// the Create entry point, and an inline composer that takes the column over
// while open. Upcoming = everything not over, which students see in the
// catalog; pins and Novinky show it from 14 days out. Past = its last day
// (endDate ?? date) has passed, kept for the society. Rows fly the console's
// map to the event.
//
// Was MyEventsPanel, which lived inside the student map's side panel. The
// society identity moved to AdminConsoleHeader, which is also where the picker
// lives, so this file no longer knows which society it is showing.
export function AdminEventList() {
  const events = useAppStore((s) => s.societyMapEvents);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const openComposer = useAppStore((s) => s.openComposer);
  const duplicateEvent = useAppStore((s) => s.duplicateEvent);
  const composerOpen = useAppStore((s) => s.composerOpen);
  const editEventId = useAppStore((s) => s.editEventId);
  const duplicateEventId = useAppStore((s) => s.duplicateEventId);
  const closeComposer = useAppStore((s) => s.closeComposer);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const reloadMapEvents = useAppStore((s) => s.reloadMapEvents);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const selection = useAppStore((s) => s.mapSelection);
  const activeId = useAppStore((s) => s.adminActiveAssociationId);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  // Delete is a two-step, in-row confirm (AdminEventRowActions). `busyId`
  // disables the row while the request is in flight.
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

  const rowActions = (e: MapEvent) => (
    <AdminEventRowActions
      confirming={confirmId === e.id}
      busy={busyId === e.id}
      onDuplicate={() => duplicateEvent(e.id)}
      onEdit={() => openComposer(e.id)}
      onArmDelete={() => setConfirmId(e.id)}
      onCancelDelete={() => setConfirmId(null)}
      onDelete={() => void remove(e.id)}
      t={t}
    />
  );

  const past = sortByDate(events.filter((e) => isFinishedEvent(e))).reverse();
  const upcoming = sortByDate(events.filter((e) => !isFinishedEvent(e)));
  // A row dated today whose time has passed: it happened, but it stays
  // publicly visible for the rest of the day, so the bucket cannot say it and
  // the row does instead. See eventWindow.hasFinished for why not the bucket.
  // An unplaced (tba) event gets no line at all: the row simply shows no place.
  const subline = (e: MapEvent) => {
    const day = eventWhenLabel(e, locale, t);
    if (hasFinished(e)) return `${day} · ${t('map.finished')}`;
    return undefined;
  };

  const section = (
    label: string,
    rows: MapEvent[],
    subline?: (e: MapEvent) => string | undefined
  ) =>
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
            footer={<EventStats eventId={e.id} />}
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
          <EventComposer
            key={editEventId ?? (duplicateEventId ? `dup-${duplicateEventId}` : 'new')}
            onDone={closeComposer}
          />
        ) : (
          <>
            {section(t('map.upcoming'), upcoming, subline)}
            {section(t('map.past'), past)}
            <EventStatsNote eventIds={[...upcoming, ...past].map((e) => e.id)} />
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
