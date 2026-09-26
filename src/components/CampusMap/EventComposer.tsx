import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import { createPost, updatePost, type PostInput } from '../../api/societyPosts';
import { isScheduledEvent, goLiveDate } from './eventWindow';
import { validateExternalUrl } from '../../mobile/openExternal';
import { MiniCalendar } from './MiniCalendar';
import { ComposerVenueSearch } from './ComposerVenueSearch';
import { ComposerTimeField } from './ComposerTimeField';
import { ComposerAudienceField } from './ComposerAudienceField';
import { ComposerCategoryField } from './ComposerCategoryField';
import { toPatch, latestCategory } from './composerPost';
import { roomCodeToName } from './mapHelpers';
import roomsIndexJson from '../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../types/campusMap';
import type { EventCategory } from '../../types/events';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

type Room = { code: string; name: string; coord: [number, number] };

// Create, edit or duplicate a society event, asked in the order a society
// thinks it: what → when → where → what kind → for whom → link. No <form>
// submit (sandboxed iframe blocks it); Publish/Save is a button.
//
// The venue KIND is derived, never asked: a picked room makes a campus event,
// a searched place or a hand-dropped pin (draftCoord) an off-campus one.
// Editing keeps the event's room/category rather than overwriting them.
export function EventComposer({ onDone }: { onDone: () => void }) {
  // The society being authored, not the account's own — a reIS admin belongs to
  // no society and picks one in the console header. RLS accepts either.
  const associationId = useAppStore((s) => s.adminActiveAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const placeDraftCoord = useAppStore((s) => s.placeDraftCoord);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const previewDraftOnMap = useAppStore((s) => s.previewDraftOnMap);
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
  const isPhone = usePhoneViewport();
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const [title, setTitle] = useState(source?.title ?? '');
  const [description, setDescription] = useState(source?.description ?? '');
  // A duplicate exists to get a new date — the one field it does not copy.
  const [date, setDate] = useState(duplicating ? '' : (source?.date ?? ''));
  const [time, setTime] = useState(source?.time ?? '');
  const [url, setUrl] = useState(source?.url ?? '');
  const [room, setRoom] = useState<Room | null>(
    source?.venueKind === 'campus' && source.roomCode && source.coord
      ? {
          code: source.roomCode,
          // roomCode is the IS-internal code ("BA39N1009"); show the hall name.
          name: source.location ?? roomCodeToName(source.roomCode, INDEX),
          coord: source.coord,
        }
      : null
  );
  // Display name of an off-campus venue from the place search; null for a pin
  // dropped by hand.
  const [placeName, setPlaceName] = useState<string | null>(
    source && source.venueKind !== 'campus' ? (source.location ?? null) : null
  );
  const [category, setCategory] = useState<EventCategory>(
    source?.category ?? latestCategory(posts) ?? 'party'
  );
  const [subscribersOnly, setSubscribersOnly] = useState(source?.subscribersOnly ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const coord = room?.coord ?? draftCoord;
  const venueName = room?.name ?? placeName ?? (draftCoord ? t('map.mapPoint') : null);
  // url is optional, but once something is typed it must be a URL openExternal
  // will actually open — the same rule EventDetailCard enforces on the way OUT.
  const trimmedUrl = url.trim();
  const urlInvalid = trimmedUrl !== '' && !validateExternalUrl(trimmedUrl);
  // Time is required: a `time: null` row has no "two hours before" and silently
  // got no reminder, and the composer is the only place these rows come from.
  const ready = !!title.trim() && !!date && !!time && !!coord && !urlInvalid;
  const scheduled = date ? isScheduledEvent(date) : false;

  const close = () => {
    clearDraftCoord();
    onDone();
  };

  // The draft pin shows every venue before publishing. Beside the map the camera
  // just goes there; on a phone the map is behind a tab, so going there unasked
  // would pull the society out of the form — it gets a button instead.
  const pinned = (c: [number, number]) => {
    placeDraftCoord(c);
    if (!isPhone) previewDraftOnMap();
  };
  const pickRoom = (sel: Room) => {
    setRoom(sel);
    setPlaceName(null);
    pinned(sel.coord);
  };
  const pickPlace = (sel: { name: string; coord: [number, number] }) => {
    setRoom(null);
    setPlaceName(sel.name);
    pinned(sel.coord);
  };
  const clearVenue = () => {
    setRoom(null);
    setPlaceName(null);
    clearDraftCoord();
  };
  const pickOnMap = () => {
    setRoom(null);
    setPlaceName(null);
    beginPlacing();
  };

  const publish = async () => {
    if (!ready || busy || !associationId || !coord) return;
    setBusy(true);
    setError(false);
    const input: PostInput = {
      title: title.trim(),
      body: description.trim(),
      category,
      date,
      time: time || null,
      venueKind: room ? 'campus' : 'offcampus',
      roomCode: room?.code ?? null,
      coordLng: coord[0],
      coordLat: coord[1],
      location: room ? null : placeName,
      url: trimmedUrl || null,
      subscribersOnly,
    };
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
      toast.success(
        editId ? t('map.toastSaved') : scheduled ? t('map.toastScheduled') : t('map.toastPublished')
      );
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

      <label className={LABEL}>{t('map.eventWhen')}</label>
      <div className="grid grid-cols-2 gap-2">
        <MiniCalendar
          value={date || null}
          onChange={setDate}
          placeholder={t('map.selectDate')}
          t={t}
          locale={locale}
        />
        <ComposerTimeField value={time} onChange={setTime} t={t} />
      </div>
      {scheduled && (
        <p className="mt-1.5 text-[11px] text-warning">
          {t('map.goesLive')}{' '}
          {goLiveDate(date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
        </p>
      )}

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

      {/* `flex flex-col`, not DaisyUI 4's dead `form-control`: an inline label
          let the 20rem input ride up over its text at iPad width. */}
      <label className="flex w-full flex-col">
        <span className={LABEL}>{t('admin.urlLabel')}</span>
        <input
          className="input input-bordered input-sm w-full"
          placeholder={t('admin.urlHint')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      {urlInvalid && <p className="mt-1 text-[11px] text-error">{t('admin.urlInvalid')}</p>}

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
