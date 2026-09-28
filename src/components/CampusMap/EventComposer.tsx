import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, updatePost } from '../../api/societyPosts';
import { isComposerReady, isUrlInvalid, buildPostInput } from './composerRules';
import { useVenuePicker } from './useVenuePicker';
import { ComposerWhenField } from './ComposerWhenField';
import { ComposerVenueSearch } from './ComposerVenueSearch';
import { ComposerAudienceField } from './ComposerAudienceField';
import { ComposerCategoryField } from './ComposerCategoryField';
import { ComposerLinkField } from './ComposerLinkField';
import { toPatch, latestCategory, initialRoom, initialPlaceName } from './composerPost';
import roomsIndexJson from '../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../types/campusMap';
import type { EventCategory } from '../../types/events';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

// Create, edit or duplicate a society event, asked in the order a society
// thinks it: what → when → where → what kind → for whom → link. No <form>
// submit (sandboxed iframe blocks it); Publish/Save is a button.
//
// The venue KIND is derived, never asked: a picked room makes a campus event,
// a searched place or a hand-dropped pin (draftCoord) an off-campus one, and
// no place at all a 'tba' one. Editing keeps the event's room/category rather
// than overwriting them.
export function EventComposer({ onDone }: { onDone: () => void }) {
  // The society being authored, not the account's own — a reIS admin belongs to
  // no society and picks one in the console header. RLS accepts either.
  const associationId = useAppStore((s) => s.adminActiveAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const reloadMapEvents = useAppStore((s) => s.reloadMapEvents);
  const editId = useAppStore((s) => s.editEventId);
  const duplicating = useAppStore((s) => s.duplicateEventId !== null);
  // What the form starts from: the event being edited, or the one being
  // duplicated. A duplicate is still a NEW event (editId stays null).
  const source = useAppStore(
    (s) => s.societyMapEvents.find((e) => e.id === (s.editEventId ?? s.duplicateEventId)) ?? null
  );
  const posts = useAppStore((s) => s.societyPosts);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const [title, setTitle] = useState(source?.title ?? '');
  const [description, setDescription] = useState(source?.description ?? '');
  // A duplicate exists to get a new date — the one field it does not copy.
  const [date, setDate] = useState(duplicating ? '' : (source?.date ?? ''));
  const [endDate, setEndDate] = useState(duplicating ? '' : (source?.endDate ?? ''));
  const [time, setTime] = useState(source?.time ?? '');
  const [url, setUrl] = useState(source?.url ?? '');
  const [category, setCategory] = useState<EventCategory>(
    source?.category ?? latestCategory(posts) ?? 'party'
  );
  const [subscribersOnly, setSubscribersOnly] = useState(source?.subscribersOnly ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const {
    room,
    placeName,
    coord,
    isPhone,
    previewDraftOnMap,
    clearDraftCoord,
    pickRoom,
    pickPlace,
    clearVenue,
    pickOnMap,
  } = useVenuePicker(initialRoom(source, INDEX), initialPlaceName(source), source?.coord ?? null);
  const venueName = room?.name ?? placeName ?? (coord ? t('map.mapPoint') : null);
  // url is optional, but once something is typed it must be a URL openExternal
  // will actually open — the same rule EventDetailCard enforces on the way OUT.
  const urlInvalid = isUrlInvalid(url);
  const ready = isComposerReady({ title, date, endDate, urlInvalid });

  const close = () => {
    clearDraftCoord();
    onDone();
  };

  const publish = async () => {
    if (!ready || busy || !associationId) return;
    setBusy(true);
    setError(false);
    const input = buildPostInput({
      title,
      description,
      category,
      date,
      endDate,
      time,
      room,
      coord,
      placeName,
      url,
      subscribersOnly,
    });
    try {
      const res = editId
        ? await updatePost(editId, toPatch(input))
        : await createPost(input, associationId, email);
      if (res.error) {
        setError(true);
        return;
      }
      await loadSocietyPosts();
      void reloadMapEvents(); // surface the change on the public "Akce" feed too
      toast.success(editId ? t('map.toastSaved') : t('map.toastPublished'));
      close();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-base-300 bg-base-200/60 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20">
          <CalendarPlus size={14} className="text-primary" />
        </span>
        <span className="text-sm font-bold">
          {editId ? t('map.editEvent') : t('map.createEvent')}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-xs ml-auto"
          aria-label={t('common.cancel')}
          onClick={close}
        >
          <X size={15} />
        </button>
      </div>

      <label className={LABEL}>{t('map.eventName')}</label>
      <input
        className="input input-bordered w-full"
        placeholder={t('map.eventName')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="flex w-full flex-col">
        <span className={LABEL}>{t('map.description')}</span>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={3}
          placeholder={t('map.descriptionHint')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <ComposerWhenField
        date={date}
        time={time}
        endDate={endDate}
        onDate={setDate}
        onTime={setTime}
        onEndDate={setEndDate}
        t={t}
        locale={locale}
      />

      <label className={LABEL}>{t('map.venueLabel')}</label>
      <ComposerVenueSearch
        selected={venueName}
        onSelectRoom={pickRoom}
        onSelectPlace={pickPlace}
        onClear={clearVenue}
        onPickOnMap={pickOnMap}
        t={t}
      />
      {isPhone && coord && (
        <button
          type="button"
          className="btn btn-ghost btn-xs mt-1.5 w-full gap-1.5 text-base-content/70"
          onClick={previewDraftOnMap}
        >
          <MapPin size={13} /> {t('map.showOnMap')}
        </button>
      )}

      <label className={LABEL}>{t('map.categoryLabel')}</label>
      <ComposerCategoryField value={category} onChange={setCategory} t={t} />

      <ComposerAudienceField
        societyId={associationId ?? ''}
        value={subscribersOnly}
        onChange={setSubscribersOnly}
      />

      <ComposerLinkField url={url} onChange={setUrl} urlInvalid={urlInvalid} t={t} />

      {error && <p className="mt-2 text-[11px] text-error">{t('admin.saveError')}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!ready || busy}
          onClick={publish}
        >
          {editId ? t('map.saveChanges') : t('map.publish')}
        </button>
      </div>
    </div>
  );
}
