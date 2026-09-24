import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayBody } from '../DayBody';
import { useAppStore } from '../../../../../store/useAppStore';
import { customEventToLesson } from '../../../../../utils/customEventLesson';
import { rsvpBlockId } from '../../../../../utils/rsvpBlocks';

vi.mock('../RecentFilesStrip', () => ({ RecentFilesStrip: () => <div /> }));
vi.mock('../MenuCard', () => ({ MenuCard: () => <div /> }));

/**
 * What a custom event's row does when it is tapped.
 *
 * The agenda hands every row to `subjectSheetFor`, which is right for a lesson
 * and wrong for everything else: a custom event carries no `courseCode`, so the
 * subject drawer would open on an empty course and try to load files, a
 * syllabus and classmates for a party. Nobody saw it before because the phone
 * never rendered these rows at all — putting them on screen is what makes the
 * tap reachable, so the tap is part of the same change.
 *
 * A society event the student answered goes to the map instead, which is the
 * only place that knows anything more about it.
 */
describe('DayBody — tapping a custom event', () => {
  const DAY = '2026-04-20';

  const party = customEventToLesson({
    id: rsvpBlockId('evt-1'),
    title: 'ESN Welcome Party',
    date: '20260420',
    startTime: '19:00',
    endTime: '20:30',
    room: 'Klub Fléda',
  });

  const ownEntry = customEventToLesson({
    id: 'custom-1',
    title: 'Zubař',
    date: '20260420',
    startTime: '08:00',
    endTime: '09:00',
    room: '',
  });

  let focusEventById: ReturnType<typeof vi.fn>;
  let focusRoomByCode: ReturnType<typeof vi.fn>;
  let pushSheet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    focusEventById = vi.fn();
    focusRoomByCode = vi.fn();
    pushSheet = vi.fn();
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'calendar',
      focusEventById,
      focusRoomByCode,
      pushSheet,
      mapEvents: [
        {
          id: 'evt-1',
          title: 'ESN Welcome Party',
          url: '',
          date: '2026-04-20',
          endDate: null,
          time: '19:00',
          location: 'Klub Fléda',
          imageUrl: null,
          organizerKey: 'mendelu',
          societyId: 'esn',
          coord: [16.6077, 49.1976],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
      ],
    } as never);
  });

  const renderRow = (lesson: typeof party) =>
    render(
      <DayBody
        agenda={[{ type: 'event', lesson }]}
        selectedIso={DAY}
        holiday={null}
        outsideTeaching={false}
        teachingStartsOn={null}
        onSelectDay={vi.fn()}
      />
    );

  it('opens the event on the map instead of a subject drawer', () => {
    renderRow(party);

    fireEvent.click(screen.getByText('ESN Welcome Party'));

    expect(pushSheet).not.toHaveBeenCalled();
    // The block id is `rsvp:<eventId>`; the map is asked for the EVENT, not for
    // the calendar block that stands in for it.
    expect(focusEventById).toHaveBeenCalledWith('evt-1', { fly: true });
    expect(useAppStore.getState().mobileTab).toBe('map');
  });

  it('does nothing at all for an entry the student typed in themselves', () => {
    // There is no event behind it and no subject either, so the row is text.
    // Sending it to the map would switch tabs and then log "unknown event".
    renderRow(ownEntry);

    fireEvent.click(screen.getByText('Zubař'));

    expect(pushSheet).not.toHaveBeenCalled();
    expect(focusEventById).not.toHaveBeenCalled();
    expect(useAppStore.getState().mobileTab).toBe('calendar');
  });

  it('still opens the subject drawer for a real lesson', () => {
    // The guard must be narrow: a lesson is why this row exists.
    renderRow({ ...party, isCustom: false, customEventId: undefined, courseCode: 'MT' });

    fireEvent.click(screen.getByText('ESN Welcome Party'));

    expect(pushSheet).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'subjectDrawer', courseCode: 'MT' })
    );
    expect(focusEventById).not.toHaveBeenCalled();
  });

  it("sends the pin to the event, not to a room called by the venue's name", () => {
    // `focusRoomByCode('Klub Fléda')` finds nothing and leaves the student on
    // an unfocused campus overview; the event knows its own coordinate.
    renderRow(party);

    fireEvent.click(screen.getByRole('button', { name: 'Ukázat na mapě' }));

    expect(focusEventById).toHaveBeenCalledWith('evt-1', { fly: true });
    expect(focusRoomByCode).not.toHaveBeenCalled();
    expect(pushSheet).not.toHaveBeenCalled();
    expect(useAppStore.getState().mobileTab).toBe('map');
  });
});
