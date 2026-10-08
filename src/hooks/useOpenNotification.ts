import { useEffect, useRef } from 'react';
import type { SpolekNotification } from '../services/spolky';
import { openExternal } from '../mobile/openExternal';
import { useAppStore } from '../store/useAppStore';
import { eventDirectLink } from '../components/CampusMap/eventLinks';
import { resolveSociety } from '../utils/societies/resolveSociety';
import { trackEventSignal } from '../api/eventSignals';

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
 * with the venue and the event's own URL on it — unless that card would add
 * nothing to the row (eventDirectLink), and then the tap goes to its link, as
 * the map list's row does. `showMap` is the only part that differs per tree: a
 * mobile tab on the phone, a view in the extension.
 *
 * The card has priority; the link is the fallback for rows with no event
 * (academic deadlines). A notification with neither a link nor a matching
 * event (one deleted since the feed was cached, or a map feed that failed to
 * load) does nothing rather than switching to a map with nothing selected —
 * and is not counted as a click, which is reserved for taps that actually
 * went somewhere.
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
  // loading") and two Opened counts for one intent. A slow row is
  // exactly the row a student taps twice, so this is the common case, not the
  // exotic one. The guard spans the in-flight load and nothing more.
  const openingRef = useRef(false);
  // Which row is holding the gate. An academic row never sets this — it never
  // reads `openingRef` at all — so it is only ever the id of the row an
  // ordinary (card-or-fallback) activation is in flight for.
  const openingIdRef = useRef<string | null>(null);

  // ...and one activation per ROW, not one per branch. An academic row
  // returns before it ever reads `openingRef`, so tapping one while a
  // linkless activation was still awaiting the map feed used to leave that
  // first handler alive: the load lands, and it focuses the earlier event
  // and switches to the map behind the browser the student was just handed.
  // A tap on a DIFFERENT row is the same situation with an ordinary row in
  // place of an academic one — `openingIdRef` is what tells the two apart
  // from a same-row double-tap, which must stay single-flight. Either way,
  // the later tap is the later intent, so it cancels the earlier one
  // outright, whichever row it landed on.
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
    const openLink = (link: string) => {
      // openExternal, not window.open: on Capacitor the system browser has no IS
      // session, and a notification's URL is data from outside the app.
      void openExternal(link);
      onClose();
    };
    // Academic rows are deadlines, not places: straight to the link.
    if (n.link && n.associationId?.startsWith('academic_')) {
      activationRef.current += 1;
      openingRef.current = false;
      openingIdRef.current = null;
      return openLink(n.link);
    }
    // Only a second tap on the SAME row while one is in flight stays
    // single-flight (a double-tap is one intent). A tap that lands on a
    // DIFFERENT row while one is in flight is a new intent and supersedes it
    // — falling through increments `activationRef` below, which is what
    // invalidates the earlier activation once its awaited load resolves.
    if (openingRef.current && openingIdRef.current === n.id) return;
    openingRef.current = true;
    openingIdRef.current = n.id;
    const activation = (activationRef.current += 1);
    try {
      // `mapEventsLoaded` flips only on SUCCESS, so it is false both before
      // the feed lands and forever after a failed load. Waiting for it here —
      // rather than reading whatever happens to be in the store at tap time —
      // is what keeps this from being the very dead tap the fix removes,
      // reachable through a race. loadMapEvents is a no-op once loaded, and
      // retries when the previous attempt failed.
      if (!mapEventsLoaded) await loadMapEvents();
      if (activationRef.current !== activation) return;
      // The CARD first, even when the event has a URL: the card carries the
      // venue, the time and the description, and the URL is its button.
      // Opening it here counts as Opened (focusEventById), the same number a
      // pin tap gives. A card with none of those is only the button, so the
      // tap is the button, and counts as Link.
      const { mapEvents: events, societies } = useAppStore.getState();
      const event = events.find((e) => e.id === n.id);
      if (event) {
        const direct = eventDirectLink(event, resolveSociety(societies, event.societyId));
        if (direct) {
          void trackEventSignal(event.id, 'link');
          return openLink(direct.href);
        }
        focusEventById(n.id, { fly: true });
        showMap();
        onClose();
        return;
      }
      if (n.link) openLink(n.link);
    } finally {
      // Only if nothing superseded us — whoever did has already reopened the
      // gate for itself, and closing it again here would wedge the row shut.
      if (activationRef.current === activation) {
        openingRef.current = false;
        openingIdRef.current = null;
      }
    }
  };

  return { opensSomewhere, openNotification };
}
