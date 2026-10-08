import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An answered society event's calendar block is removed by withdrawing the
 * answer, on both trees — by different UI on each, deliberately.
 *
 * The block (`rsvp:<eventId>`) is derived from the student's "Mám zájem" by
 * `planRsvpBlocks`, and `rsvpBlockSync` re-adds a deleted one and overwrites an
 * edited one. So deleting or moving it as a custom event "worked" and then
 * reverted (Task List Sprint 12, "možnost přesouvat si eventy nebo
 * odstraňovat?"). Moving stays impossible by design: the society owns the time.
 *
 * DESKTOP: clicking the block used to open `CustomEventModal`, whose Smazat and
 * Uložit both lied. It now opens `RsvpBlockPopover`, whose one action is the
 * store's `withdrawRsvpBlock` → `setRsvp`. No "show on map" there — see
 * `desktopHasNoShowOnMap.test.ts`.
 *
 * PHONE / iPad: no new control, on purpose. The block already sends the student
 * to the event (`useOpenLesson`), and the event card carries the RSVP toggle
 * (`EventRsvp`), so un-pressing "Mám zájem" there withdraws the answer and the
 * block goes with it — measured at 390 and 834 (2026-10-08). The phone tree has
 * no custom-event editor at all, so it never had the lying delete.
 */
const src = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

function filesUnder(dir: string): string[] {
  const abs = resolve(process.cwd(), 'src', dir);
  return readdirSync(abs).flatMap((name) => {
    const full = join(abs, name);
    return statSync(full).isDirectory() ? filesUnder(join(dir, name)) : [join(dir, name)];
  });
}

describe('removing an answered event from the calendar', () => {
  it('desktop: components/WeeklyCalendar/index.tsx routes an rsvp block away from the edit modal', () => {
    const calendar = src('components/WeeklyCalendar/index.tsx');
    expect(calendar).toContain('isRsvpBlock(event.id)) setOpenRsvpBlock');
    expect(calendar).toContain('<RsvpBlockPopover');
  });

  it('desktop: components/WeeklyCalendar/RsvpBlockPopover.tsx withdraws through the store, never deletes', () => {
    const popover = src('components/WeeklyCalendar/RsvpBlockPopover.tsx');
    expect(popover).toContain('withdrawRsvpBlock(event.id)');
    expect(popover).not.toContain('removeCalendarCustomEvent');
    expect(popover).not.toContain('showOnMap');
  });

  it('phone: the block opens the event, whose card carries the RSVP toggle', () => {
    expect(src('components/mobile/screens/calendar/useOpenLesson.ts')).toContain(
      'eventIdFromRsvpBlock'
    );
    expect(src('components/CampusMap/EventDetailCard.tsx')).toContain('<EventRsvp');
    expect(src('components/mobile/screens/map/MapPanelBody.tsx')).toContain('EventDetailCard');
  });

  it('phone: has no custom-event editor that could delete or move an rsvp block', () => {
    const offenders = [...filesUnder('components/mobile'), ...filesUnder('mobile')].filter((f) =>
      /CustomEventModal|removeCalendarCustomEvent|updateCalendarCustomEvent/.test(src(f))
    );
    expect(offenders).toEqual([]);
  });
});
