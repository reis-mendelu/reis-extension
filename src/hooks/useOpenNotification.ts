import { useEffect, useRef } from 'react';
import { trackNotificationClick } from '../services/spolky';
import type { SpolekNotification } from '../services/spolky';
import { openExternal } from '../mobile/openExternal';
import { useAppStore } from '../store/useAppStore';

/**
 * What tapping a notification does, for BOTH trees — the phone's Novinky sheet
 * and the extension's bell dropdown. It lived in the phone sheet alone, and the
 * dropdown kept the old link-only handler: #254 fixed the dead tap on the phone
 * and the same event stayed a disabled row in the extension.
 *
 * A notification IS a `spolky_events` row — `fetchNotifications` reads that
 * table and maps its optional `url` column to `link`. Gating the whole tap on
 * that link meant every society event without one, which is most of them, was
 * announced and could not be opened.
 *
 * The row's id is the map event's id (one `spolky_events` id space, mapped by
 * `toMapEvent`), so `focusEventById` opens the same EventDetailCard a pin does,
 * with the venue, the RSVP and the event's own URL on it. `showMap` is the only
 * part that differs per tree: a mobile tab on the phone, a view in the extension.
 *
 * The link keeps priority where it exists: an author who set a URL chose a
 * destination, and the academic feed's rows are deadlines rather than places.
 * A notification with neither a link nor a matching event (a far-future one
 * the public map filters out) does nothing rather than switching to a map with
 * nothing selected — and is not counted as a click, which is reserved for taps
 * that actually went somewhere.
 */
export function useOpenNotification({
  onClose,
  showMap,
}: {
  onClose: () => void;
  showMap: () => void;
}) {
  const mapEvents = useAppStore((s) => s.mapEvents);
  const mapEventsLoaded = useAppStore((s) => s.mapEventsLoaded);
  const loadMapEvents = useAppStore((s) => s.loadMapEvents);
  const focusEventById = useAppStore((s) => s.focusEventById);

  // The same question the tap asks, asked for the affordance: a row that opens
  // something has to look like it does. While the map feed is still outstanding
  // the answer is "assume it does" — every notification IS an event row, so a
  // match is the overwhelmingly common case, and guessing the other way paints
  // the row as dead for as long as the fetch takes.
  const opensSomewhere = (n: SpolekNotification) =>
    !!n.link || !mapEventsLoaded || mapEvents.some((e) => e.id === n.id);

  // One activation at a time. Awaiting the load opens a window the synchronous
  // version never had, and a second tap inside it ran a second handler: two
  // fetches (loadMapEvents guards on "already loaded", not on "already
  // loading") and two increment_post_click RPCs for one intent. A slow row is
  // exactly the row a student taps twice, so this is the common case, not the
  // exotic one. The guard spans the in-flight load and nothing more.
  const openingRef = useRef(false);

  // ...and one activation TOTAL, not one per branch. A linked row returns
  // before it ever reads `openingRef`, so tapping one while a linkless
  // activation was still awaiting the map feed used to leave that first
  // handler alive: the load lands, and it focuses the earlier event and
  // switches to the map behind the browser the student was just handed. The
  // later tap is the later intent, so it cancels the earlier one outright.
  //
  // Dismissing the surface is a supersession too — the student who closes it
  // mid-load has left, and a handler with no surface left must not drag the
  // map up over whatever they went to instead.
  const activationRef = useRef(0);
  useEffect(
    () => () => {
      activationRef.current += 1;
    },
    []
  );

  const openNotification = async (n: SpolekNotification) => {
    const track = () => {
      if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
    };
    if (n.link) {
      activationRef.current += 1;
      openingRef.current = false;
      track();
      // openExternal, not window.open: on Capacitor that hands the URL to the
      // system browser, which has no IS session. It also validates the link —
      // a notification's URL is data from outside the app.
      void openExternal(n.link);
      onClose();
      return;
    }
    // `mapEventsLoaded` flips only on SUCCESS, so it is false both before the
    // feed lands and forever after a failed load. Waiting for it here — rather
    // than reading whatever happens to be in the store at tap time — is what
    // keeps this from being the very dead tap the fix removes, reachable
    // through a race. loadMapEvents is a no-op once loaded, and retries when
    // the previous attempt failed.
    if (openingRef.current) return;
    openingRef.current = true;
    const activation = (activationRef.current += 1);
    try {
      if (!mapEventsLoaded) await loadMapEvents();
      if (activationRef.current !== activation) return;
      if (!useAppStore.getState().mapEvents.some((e) => e.id === n.id)) return;
      track();
      focusEventById(n.id, { fly: true });
      showMap();
      onClose();
    } finally {
      // Only if nothing superseded us — whoever did has already reopened the
      // gate for itself, and closing it again here would wedge the row shut.
      if (activationRef.current === activation) openingRef.current = false;
    }
  };

  return { opensSomewhere, openNotification };
}
