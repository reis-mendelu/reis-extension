import { useState } from 'react';
import { CalendarPlus, MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, updatePost, type PostInput } from '../../api/societyPosts';
import { isScheduledEvent, goLiveDate } from './eventWindow';
import { MiniCalendar } from './MiniCalendar';
import { ComposerRoomSearch } from './ComposerRoomSearch';

// Create/edit a society event. No <form> submit (sandboxed iframe blocks it);
// Publish/Save is a button. Venue is either a free-placed off-campus point
// (draftCoord, captured by clicking the map) or a searched campus room
// (ComposerRoomSearch, which resolves its own coord). Editing preserves the
// event's venue_kind/room_code/category instead of overwriting them — the old
// version hardcoded venueKind:'offcampus' on every save, silently rewriting
// campus events back to a free point (CodeRabbit Critical).
export function EventComposer({ onDone }: { onDone: () => void }) {
  const associationId = useAppStore((s) => s.adminAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const editId = useAppStore((s) => s.editEventId);
  const editing = useAppStore((s) => s.societyMapEvents.find((e) => e.id === s.editEventId) ?? null);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(editing?.date ?? '');
  const [venue, setVenue] = useState<'offcampus' | 'campus'>(editing?.venueKind === 'campus' ? 'campus' : 'offcampus');
  const [room, setRoom] = useState<{ code: string; name: string; coord: [number, number] } | null>(
    editing && editing.venueKind === 'campus' && editing.roomCode && editing.coord
      ? { code: editing.roomCode, name: editing.location ?? editing.roomCode, coord: editing.coord }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const coord = venue === 'campus' ? room?.coord ?? null : draftCoord;
  const ready = !!title.trim() && !!date && !!coord;
  const scheduled = date ? isScheduledEvent(date) : false;

  const close = () => { clearDraftCoord(); onDone(); };

  const switchVenue = (v: 'offcampus' | 'campus') => {
    if (v === venue) return;
    setVenue(v);
    setRoom(null);
    if (v === 'campus') clearDraftCoord();
  };

  const publish = async () => {
    if (!ready || busy || !associationId || !coord) return;
    setBusy(true); setError(false);
    const input: PostInput = {
      title: title.trim(), body: '', category: editing?.category ?? 'party', date,
      venueKind: venue, roomCode: venue === 'campus' ? room?.code ?? null : null,
      coordLng: coord[0], coordLat: coord[1],
    };
    try {
      const res = editId
        ? await updatePost(editId, {
            title: input.title, date: input.date, category: input.category,
            venue_kind: input.venueKind, room_code: input.roomCode ?? null,
            coord_lng: input.coordLng, coord_lat: input.coordLat,
          })
        : await createPost(input, associationId, email);
      if (res.error) { setError(true); return; }
      await loadSocietyPosts();
      close();
    } catch { setError(true); } finally { setBusy(false); }
  };

  return (
    <div className="border-b border-base-300 bg-base-200/60 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20"><CalendarPlus size={14} className="text-primary" /></span>
        <span className="text-sm font-bold">{editId ? t('map.editEvent') : t('map.createEvent')}</span>
        <button type="button" className="btn btn-ghost btn-xs ml-auto" aria-label={t('common.cancel')} onClick={close}><X size={15} /></button>
      </div>

      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">{t('map.eventName')}</label>
      <input className="input input-bordered w-full" placeholder={t('map.eventName')} value={title} onChange={(e) => setTitle(e.target.value)} />

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">{t('map.eventDate')}</label>
      <MiniCalendar value={date || null} onChange={setDate} placeholder={t('map.selectDate')} t={t} locale={locale} />
      {scheduled && (
        <p className="mt-1.5 text-[11px] text-warning">{t('map.goesLive')} {goLiveDate(date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</p>
      )}

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">{t('map.venueLabel')}</label>
      <div className="flex gap-2">
        <button type="button" className={`btn btn-sm flex-1 gap-1 ${venue === 'offcampus' ? 'btn-primary' : 'btn-outline'}`} onClick={() => switchVenue('offcampus')}>
          <MapPin size={13} /> {t('map.venueOffcampus')}
        </button>
        <button type="button" className={`btn btn-sm flex-1 gap-1 ${venue === 'campus' ? 'btn-primary' : 'btn-outline'}`} onClick={() => switchVenue('campus')}>
          {t('map.venueCampus')}
        </button>
      </div>

      {venue === 'campus' ? (
        <ComposerRoomSearch selected={room ? { code: room.code, name: room.name } : null} onSelect={setRoom} onClear={() => setRoom(null)} t={t} />
      ) : (
        <>
          <button type="button" className={`btn btn-sm mt-2 w-full gap-2 ${draftCoord ? 'btn-outline' : 'btn-ghost border border-dashed border-base-content/30'}`} onClick={beginPlacing}>
            <MapPin size={14} /> {draftCoord ? t('map.changePlace') : t('map.selectPlace')}
          </button>
          <p className="mt-1.5 text-[11px] text-base-content/50">{draftCoord ? '' : t('map.clickToPlace')}</p>
        </>
      )}

      {error && <p className="mt-2 text-[11px] text-error">{t('admin.saveError')}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>{t('common.cancel')}</button>
        <button type="button" className="btn btn-primary btn-sm flex-1" disabled={!ready || busy} onClick={publish}>
          {editId ? t('map.saveChanges') : t('map.publish')}
        </button>
      </div>
    </div>
  );
}
