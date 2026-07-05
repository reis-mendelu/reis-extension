import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, updatePost, type PostInput } from '../../api/societyPosts';

// Create an event by clicking the map. No <form> submit (sandboxed iframe blocks
// it); Publish is a button. Place is captured into the store's draftCoord by the
// map click, so this form owns only name + date. venueKind is 'offcampus' because
// the coordinate is a free point, not a room (satisfies the venue check constraint).
export function EventComposer({ onDone }: { onDone: () => void }) {
  const associationId = useAppStore((s) => s.adminAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const editId = useAppStore((s) => s.editEventId);
  const editing = useAppStore((s) => s.societyMapEvents.find((e) => e.id === s.editEventId) ?? null);
  const { t } = useTranslation();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(editing?.date ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const ready = !!title.trim() && !!date && !!draftCoord;

  const close = () => { clearDraftCoord(); onDone(); };

  const publish = async () => {
    if (!ready || busy || !associationId || !draftCoord) return;
    setBusy(true); setError(false);
    const input: PostInput = {
      title: title.trim(), body: '', category: 'party', date,
      venueKind: 'offcampus', coordLng: draftCoord[0], coordLat: draftCoord[1],
    };
    try {
      const res = editId
        ? await updatePost(editId, {
            title: input.title, date: input.date,
            coord_lng: input.coordLng, coord_lat: input.coordLat, venue_kind: input.venueKind,
          })
        : await createPost(input, associationId, email);
      if (res.error) { setError(true); return; }
      await loadSocietyPosts();
      close();
    } catch { setError(true); } finally { setBusy(false); }
  };

  return (
    <div className="flex w-72 flex-col gap-3 rounded-box border border-base-300 bg-base-100/95 p-3 shadow-popover-heavy backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{editId ? t('map.editEvent') : t('map.createEvent')}</span>
        <button type="button" className="btn btn-ghost btn-xs" aria-label={t('common.close')} onClick={close}><X size={14} /></button>
      </div>
      {error && <p className="text-error text-xs">{t('admin.saveError')}</p>}
      <label className="flex flex-col gap-1 text-xs">
        <span className="opacity-70">{t('map.eventName')}</span>
        <input aria-label={t('map.eventName')} className="input input-bordered input-sm" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="opacity-70">{t('map.eventDate')}</span>
        <input aria-label={t('map.eventDate')} type="date" className="input input-bordered input-sm" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="button" className={`btn btn-sm gap-1 ${draftCoord ? 'btn-success btn-outline' : 'btn-outline'}`} onClick={beginPlacing}>
        <MapPin size={14} /> {draftCoord ? t('map.changePlace') : t('map.selectPlace')}
      </button>
      <button type="button" className="btn btn-primary btn-sm" disabled={!ready || busy} onClick={publish}>{editId ? t('map.saveChanges') : t('map.publish')}</button>
    </div>
  );
}
