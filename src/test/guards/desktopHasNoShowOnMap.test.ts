import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Ukázat na mapě" was removed from the DESKTOP tree only.
 *
 * On desktop it was a button labelled with a whole sentence, sitting inside a
 * calendar block that is minutes tall, next to a room name that already said
 * where the lesson was. The room stays reachable on the map — the control is
 * the room itself now, as it already was for Q rooms.
 *
 * Both halves are pinned here. The phone keeps its button — a pin on every
 * agenda row, since touch has no hover affordance to replace it — and so does
 * the admin console's event composer, where it previews an unpublished event's
 * pin and is the whole point of the screen. A later "let's just reuse this
 * component" is exactly how the desktop one comes back.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('showOnMap placement', () => {
  it.each([
    'components/CalendarEventCard.tsx',
    'components/MapHoverCard.tsx',
    'components/SubjectFileDrawer/Header/CourseMeta.tsx',
  ])('%s does not offer a "show on map" button', (file) => {
    expect(read(file)).not.toContain('showOnMap');
  });

  it.each([
    'components/mobile/screens/calendar/AgendaEvent.tsx',
    'components/CampusMap/EventComposer.tsx',
  ])('%s still does', (file) => {
    expect(read(file)).toContain('showOnMap');
  });

  /**
   * Where a calendar event lands on the map is phone/iPad only, for the same
   * reason: the desktop calendar has no path from an event to the map at all.
   *
   * On the phone, the row, its pin and "Trasa →" send an answered society event
   * to the map with `reveal: 'map'`, and the sheet stays at peek so the PIN is
   * what the student sees — the card had covered it (Pixel 9a, #418). The
   * desktop has no bottom sheet: DetailPanel floats beside the map there, so
   * the defect had nowhere to happen, and there is no tap to fix.
   */
  it.each([
    'components/mobile/screens/calendar/DayBody.tsx',
    'components/mobile/screens/calendar/useShowLessonOnMap.ts',
  ])('%s sends an answered event to the map', (file) => {
    expect(read(file)).toMatch(/eventIdFromRsvpBlock|showOnMap\(lesson\)/);
  });

  it('the phone asks for the pin, and its sheet and peek row honour it', () => {
    expect(read('components/mobile/screens/calendar/useShowLessonOnMap.ts')).toContain(
      "reveal: 'map'"
    );
    expect(read('components/mobile/screens/map/MapSheet.tsx')).toContain("reveal === 'map'");
    expect(read('components/mobile/screens/map/MapSheetPeek.tsx')).toContain('mapSelection');
  });

  it('the desktop calendar has no event-to-map path to carry it', () => {
    const card = read('components/CalendarEventCard.tsx');
    expect(card).not.toContain('eventIdFromRsvpBlock');
    expect(card).not.toContain('focusEventById');
  });

  it('keeps the translation key, since the surfaces that stayed still use it', () => {
    const cs = JSON.parse(read('i18n/locales/cs.json')) as Record<string, Record<string, string>>;
    expect(cs['map']?.['showOnMap']).toBe('Ukázat na mapě');
  });
});
