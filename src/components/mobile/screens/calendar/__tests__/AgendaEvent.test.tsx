import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaEvent } from '../AgendaEvent';
import { useAppStore } from '../../../../../store/useAppStore';
import { makeLesson } from '../../../../../test/fixtures/lesson';
import { customEventToLesson } from '../../../../../utils/customEventLesson';

describe('AgendaEvent', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('tapping the row opens the subject and does not touch the map', () => {
    const onOpenSubject = vi.fn();
    const onShowOnMap = vi.fn();
    render(
      <AgendaEvent
        lesson={makeLesson({ courseName: 'Management' })}
        onOpenSubject={onOpenSubject}
        onShowOnMap={onShowOnMap}
      />
    );

    fireEvent.click(screen.getByText('Management'));

    expect(onOpenSubject).toHaveBeenCalledTimes(1);
    expect(onShowOnMap).not.toHaveBeenCalled();
  });

  it('tapping the pin shows the map and does not open the subject', () => {
    const onOpenSubject = vi.fn();
    const onShowOnMap = vi.fn();
    render(
      <AgendaEvent lesson={makeLesson()} onOpenSubject={onOpenSubject} onShowOnMap={onShowOnMap} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ukázat na mapě' }));

    expect(onShowOnMap).toHaveBeenCalledTimes(1);
    expect(onOpenSubject).not.toHaveBeenCalled();
  });

  it('is two controls, not a button inside a button', () => {
    render(<AgendaEvent lesson={makeLesson()} onOpenSubject={() => {}} onShowOnMap={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.parentElement?.closest('button')).toBeNull();
  });
});

/**
 * The phone half of the same defect the desktop drawer had. The pin used to
 * render on every row, and tapping it switched the student to the Map tab
 * whatever the room was — so for a room the dataset does not carry (building X
 * at Zahradnická fakulta ships 105 raw BA25* entries and no X0* handle at all)
 * they lost their place in the week and got an unfocused campus overview.
 */
describe('AgendaEvent pin, for a room the map cannot find', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  it.each([
    ['A01', 'a hall the index knows only by nickname'],
    ['Q01', 'a PEF hall'],
    ['T18', 'a room with no floor plan, whose building T is on the map'],
    ['ZFAC1 (Led)', 'a room on the Lednice campus'],
  ])('offers the pin for %s (%s)', (room) => {
    render(
      <AgendaEvent lesson={makeLesson({ room })} onOpenSubject={vi.fn()} onShowOnMap={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Ukázat na mapě' })).toBeInTheDocument();
  });

  it.each([
    ['Lesní škola Jezírko (ŠLP)', 'a room IS files in two places at once'],
    ['B Virtuální 6', 'a lesson held online'],
  ])('withholds the pin for %s (%s)', (room) => {
    render(
      <AgendaEvent lesson={makeLesson({ room })} onOpenSubject={vi.fn()} onShowOnMap={vi.fn()} />
    );
    expect(screen.queryByRole('button', { name: 'Ukázat na mapě' })).toBeNull();
  });
});

describe('AgendaEvent, for an entry the student typed in', () => {
  it('prints no dangling separator for an entry with no place at all', () => {
    useAppStore.setState({ language: 'cz' } as never);
    const own = customEventToLesson({
      id: 'custom-1',
      title: 'Zubař',
      date: '20260924',
      startTime: '08:00',
      endTime: '09:00',
    });
    render(<AgendaEvent lesson={own} onOpenSubject={vi.fn()} onShowOnMap={vi.fn()} />);
    expect(screen.getByText('08:00 – 09:00')).toBeInTheDocument();
  });
});
