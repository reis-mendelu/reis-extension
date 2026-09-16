import { describe, it, expect } from 'vitest';
import { visibleToStudent, audienceLabelKey } from '../eventAudience';
import type { MapEvent } from '../../types/events';

/**
 * Who a society event is for.
 *
 * A society picks, per event, between everyone's map and the maps of the
 * students who follow it. The filter runs on the CLIENT — the map's fetch is
 * anonymous and subscriptions live in the student's own IndexedDB — so this is
 * noise control, not access control, and the tests below are about what a
 * student is shown, never about what they could obtain.
 */
function event(over: Partial<MapEvent> = {}): MapEvent {
  return {
    id: 'e1',
    societyId: 'supef',
    subscribersOnly: false,
    coord: [16.6, 49.2],
    roomCode: null,
    venueKind: 'offcampus',
    category: 'party',
    ...over,
  } as MapEvent;
}

describe('visibleToStudent', () => {
  it('shows an unrestricted event to somebody who follows nothing', () => {
    const open = event({ subscribersOnly: false });
    expect(visibleToStudent([open], [])).toEqual([open]);
  });

  it('hides a restricted event from somebody who does not follow that society', () => {
    expect(visibleToStudent([event({ subscribersOnly: true })], ['esn'])).toEqual([]);
  });

  it('shows a restricted event to a follower', () => {
    const own = event({ subscribersOnly: true, societyId: 'esn' });
    expect(visibleToStudent([own], ['esn', 'supef'])).toEqual([own]);
  });

  it('keeps the two kinds straight in one list', () => {
    const open = event({ id: 'open', subscribersOnly: false, societyId: 'usaf' });
    const theirs = event({ id: 'theirs', subscribersOnly: true, societyId: 'usaf' });
    const mine = event({ id: 'mine', subscribersOnly: true, societyId: 'supef' });
    expect(visibleToStudent([open, theirs, mine], ['supef']).map((e) => e.id)).toEqual([
      'open',
      'mine',
    ]);
  });

  it('treats a missing flag as open, so a row written before the column existed still shows', () => {
    const legacy = event();
    delete (legacy as { subscribersOnly?: boolean }).subscribersOnly;
    expect(visibleToStudent([legacy], [])).toEqual([legacy]);
  });

  it('hides nothing while the subscription list is still unknown', () => {
    // `useSpolkySettings` reads IndexedDB, so the list is empty for a tick or
    // two on a cold open. Hiding then would blink every restricted event off
    // the map and back — and an empty list is also a legitimate "I follow
    // nothing", which is exactly when a restricted event SHOULD be hidden. The
    // caller distinguishes them; this function is told, never guesses.
    const restricted = event({ subscribersOnly: true });
    expect(visibleToStudent([restricted], null)).toEqual([restricted]);
  });
});

describe('audienceLabelKey', () => {
  it('names the faculty for a society that has exactly one', () => {
    expect(audienceLabelKey('supef')).toEqual({ key: 'admin.audience.faculty', faculty: 'PEF' });
    expect(audienceLabelKey('usaf')).toEqual({ key: 'admin.audience.faculty', faculty: 'AF' });
  });

  it('uses the society’s own audience when it is not one faculty', () => {
    // ESN is cross-faculty (`facultyIds: []`) and its audience is the Erasmus
    // students, which no faculty code can express.
    expect(audienceLabelKey('esn')).toEqual({ key: 'admin.audience.erasmus' });
  });

  it('falls back to something true for a society it does not know', () => {
    expect(audienceLabelKey('brand_new_spolek')).toEqual({ key: 'admin.audience.followers' });
  });
});
