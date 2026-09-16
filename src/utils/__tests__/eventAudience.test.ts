import { describe, it, expect } from 'vitest';
import { visibleToStudent, audienceLabelKey, audienceHint } from '../eventAudience';
import { translate } from '../../i18n/translate';
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

describe('audienceHint', () => {
  it('names the society when there is a name to print', () => {
    expect(audienceHint('supef')).toEqual({ key: 'map.audienceHint', society: 'SUPEF' });
  });

  it('uses a sentence with no hole in it when there is not', () => {
    // The reis_admin super-admin and the dev session both carry ids that are
    // not associations. Interpolating the empty name rendered "Uvidí studenti,
    // kteří odebírají ." on screen.
    expect(audienceHint('reis')).toEqual({ key: 'map.audienceHintGeneric' });
  });
});

/**
 * The strings themselves, resolved.
 *
 * Asserting the KEY is not enough and this is why: the keys were right and the
 * copy still rendered "odebírají {}." — the placeholders were written as
 * `{{society}}` while `translate` interpolates `{society}`, so the regex
 * replaced the inner braces and left the outer pair on screen. Only reading the
 * finished sentence catches that.
 */
describe('the audience copy resolves, in both languages', () => {
  it.each(['cz', 'en'])('leaves no braces behind in the hint (%s)', (lang) => {
    const hint = audienceHint('supef');
    const text = translate(lang, hint.key, hint.society ? { society: hint.society } : undefined);
    expect(text).toContain('SUPEF');
    expect(text).not.toMatch(/[{}]/);
  });

  it.each(['cz', 'en'])('leaves no braces behind in the faculty label (%s)', (lang) => {
    const label = audienceLabelKey('supef');
    const text = translate(lang, label.key, label.faculty ? { faculty: label.faculty } : undefined);
    expect(text).toContain('PEF');
    expect(text).not.toMatch(/[{}]/);
  });

  it.each(['cz', 'en'])('has real copy for every audience key (%s)', (lang) => {
    // `translate` returns the KEY when it cannot find a string, so a missing
    // translation is silent on screen — it just looks like a dotted id.
    for (const key of [
      'map.audienceLabel',
      'map.audienceEveryone',
      'map.audienceHintGeneric',
      'admin.audience.erasmus',
      'admin.audience.followers',
    ]) {
      expect(translate(lang, key)).not.toBe(key);
    }
  });
});
