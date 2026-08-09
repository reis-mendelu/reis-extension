import { describe, it, expect } from 'vitest';
import { resolveRoomCode } from '../resolveRoomCode';

/**
 * Real entries from `src/data/map/rooms-index.json`:
 *   { code: "BA39N2056", name: "Q2.56", nickname: null }
 *   { code: "BA01N2056", name: "BA01N2056", nickname: "A221" }
 */
describe('resolveRoomCode', () => {
  it('resolves an estate code from a staff profile', () => {
    expect(resolveRoomCode(['BA39N2056'])).toEqual({ code: 'BA39N2056', label: 'Q2.56' });
  });

  it('resolves the friendly name the same room is also known by', () => {
    expect(resolveRoomCode(['Q2.56'])).toEqual({ code: 'BA39N2056', label: 'Q2.56' });
  });

  it('prefers a nickname as the label when the room has one', () => {
    // The index stores rooms whose `name` is just the code again; the nickname
    // is the only human-readable string those have.
    expect(resolveRoomCode(['BA01N2056'])).toEqual({ code: 'BA01N2056', label: 'A221' });
  });

  it('strips the campus a timetable prints after the room', () => {
    expect(resolveRoomCode(['Q2.56 (Poříčí)'])?.code).toBe('BA39N2056');
  });

  it('falls through to the next candidate when the first is unknown', () => {
    expect(resolveRoomCode([null, 'NOT-A-ROOM', 'Q2.56'])?.code).toBe('BA39N2056');
  });

  it('returns null rather than a code the map cannot find', () => {
    // The caller uses this to decide whether to render the button at all —
    // focusRoomByCode only logs an unknown room, so a wrong answer here is a
    // button that silently does nothing.
    expect(resolveRoomCode(['NOT-A-ROOM', undefined, ''])).toBeNull();
    expect(resolveRoomCode([])).toBeNull();
  });
});
