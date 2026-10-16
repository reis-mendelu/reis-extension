import { useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, updatePost } from '../../api/societyPosts';
import { isComposerReady, isUrlInvalid, buildPostInput } from './composerRules';
import { useVenuePicker } from './useVenuePicker';
import { ComposerWhenField } from './ComposerWhenField';
import { ComposerVenueFields } from './ComposerVenueFields';
import { ComposerKindField } from './ComposerKindField';
import { ComposerTextFields } from './ComposerTextFields';
import { useComposerKind } from './useComposerKind';
import { ComposerAudienceField } from './ComposerAudienceField';
import { ComposerEmojiField } from './ComposerEmojiField';
import { ComposerLinkField } from './ComposerLinkField';
import { toPatch, latestEmoji, initialRoom, initialPlaceName, initialKind } from './composerPost';
import { eventEmojiCode, CATEGORY_EMOJI_CODE } from '../../data/eventEmoji';
import roomsIndexJson from '../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../types/campusMap';
import { ComposerHeader, ComposerActions } from './ComposerChrome';
import { useComposerAuthor } from './useComposerAuthor';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

// Create, edit or duplicate a society post, asked in the order a society
// thinks it: event or notice → what → when → where → picture → for whom →
// link. A notice (Novinky only) has no place, so it skips where and picture.
// No <form> submit (sandboxed iframe blocks it); Publish/Save is a button.
// The venue KIND is derived, never asked: a room makes a campus event, a place
// or a dropped pin (draftCoord) an off-campus one, no place a 'tba' one.
// Editing keeps the event's room/emoji rather than overwriting them.
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
  const { cannotRestrict, authorIsPartner, authorKnown } = useComposerAuthor(associationId);
  const blockedUnknownAuthor = !authorKnown && !editId;
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const [title, setTitle] = useState(source?.title ?? '');
  const [description, setDescription] = useState(source?.description ?? '');
  // A duplicate exists to get a new date, so the dates are the fields it does
  // not copy: the start AND the end. A copied end date would sit before (or
  // oddly after) whatever new start is picked; a trip is re-spanned by hand.
  const [date, setDate] = useState(duplicating ? '' : (source?.date ?? ''));
  const [endDate, setEndDate] = useState(duplicating ? '' : (source?.endDate ?? ''));
  const [time, setTime] = useState(source?.time ?? '');
  const [url, setUrl] = useState(source?.url ?? '');
  // An edit keeps the stored code even when this build does not ship it:
  // swapping it for the fallback would rewrite the event on any save.
  const [startEmoji] = useState(() => (source ? (source.emoji ?? eventEmojiCode(source)) : null));
  const [emoji, setEmoji] = useState<string>(
    startEmoji ?? latestEmoji(posts) ?? CATEGORY_EMOJI_CODE.party
  );
  const [subscribersOnly, setSubscribersOnly] = useState(source?.subscribersOnly ?? false);
  const [kind, changeKind] = useComposerKind(source);
  const notice = kind === 'notice';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const venue = useVenuePicker(
    initialRoom(source, INDEX),
    initialPlaceName(source),
    source?.coord ?? null
  );
  const { room, placeName, coord, clearDraftCoord } = venue;
  // url is optional, but once something is typed it must be a URL openExternal
  // will actually open — the same rule EventDetailCard enforces on the way OUT.
  const urlInvalid = isUrlInvalid(url);
  const ready = isComposerReady({ title, date, endDate, urlInvalid });

  const close = () => {
    clearDraftCoord();
    onDone();
  };

  const publish = async () => {
    if (!ready || busy || !associationId || blockedUnknownAuthor) return;
    setBusy(true);
    setError(false);
    const input = buildPostInput({
      title,
      description,
      emoji,
      fallbackCategory: source?.category ?? 'other',
      startEmoji,
      date,
      endDate,
      time,
      room,
      coord,
      placeName,
      url,
      // A society with no narrower audience (reIS) cannot restrict: a legacy
      // flag on an edited row is cleared rather than silently kept.
      // Partners are always restricted: released builds without the audience
      // rule then show the event only to the partner's faculty, never to all.
      subscribersOnly: authorIsPartner || (!cannotRestrict && subscribersOnly),
      kind,
    });
    try {
      const res = editId
        ? await updatePost(editId, toPatch(input, initialKind(source)))
        : await createPost(input, associationId, email);
      if (res.error) {
        setError(true);
        return;
      }
      await loadSocietyPosts();
      void reloadMapEvents(); // surface the change on the public "Akce" feed too
      toast.success(
        t(editId ? 'map.toastSaved' : notice ? 'map.toastPublishedNotice' : 'map.toastPublished')
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
      <ComposerHeader kind={kind} editing={!!editId} onClose={close} t={t} />

      <ComposerKindField value={kind} onChange={changeKind} t={t} />

      <ComposerTextFields
        kind={kind}
        title={title}
        description={description}
        onTitle={setTitle}
        onDescription={setDescription}
        t={t}
      />

      <ComposerWhenField
        date={date}
        time={time}
        endDate={endDate}
        onDate={setDate}
        onTime={setTime}
        onEndDate={setEndDate}
        t={t}
        locale={locale}
        endLabel={notice ? 'map.noticeEndDate' : undefined}
        withTime={!notice}
      />

      {/* Novinky draws no picture, so a notice is not asked for one either. */}
      {!notice && (
        <>
          <ComposerVenueFields venue={venue} t={t} />
          <label className={LABEL}>{t('map.emojiPickerLabel')}</label>
          <ComposerEmojiField value={emoji} onChange={setEmoji} t={t} language={language} />
        </>
      )}

      <ComposerAudienceField
        societyId={associationId ?? ''}
        value={subscribersOnly}
        onChange={setSubscribersOnly}
      />

      <ComposerLinkField url={url} onChange={setUrl} urlInvalid={urlInvalid} t={t} />

      <ComposerActions
        kind={kind}
        editing={!!editId}
        disabled={!ready || busy || blockedUnknownAuthor}
        error={error}
        onClose={close}
        onPublish={publish}
        t={t}
      />
    </div>
  );
}
