import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NowNextCard } from '../NowNextCard';
import { useAppStore } from '../../../../../store/useAppStore';
import { makeLesson } from '../../../../../test/fixtures/lesson';
import { customEventToLesson } from '../../../../../utils/customEventLesson';
import { rsvpBlockId } from '../../../../../utils/rsvpBlocks';
import type { NowNext } from '../../../../../utils/mobile/nowNext';

function nowNext(over: Partial<NowNext> = {}): NowNext {
  return {
    current: makeLesson({
      courseName: 'base-current',
      courseNameCs: 'cz-current',
      courseNameEn: 'en-current',
      room: 'base-room',
      roomCs: 'cz-room',
      roomEn: 'en-room',
    }),
    elapsedPct: 40,
    minutesLeft: 20,
    next: null,
    ...over,
  };
}

describe('NowNextCard', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  // The badge said "TEĎ BĚŽÍ" above a card that only ever renders while
  // something IS running, next to a countdown that says the same thing — three
  // ways of saying one fact, at the top of the screen.
  //
  // The countdown shares the room's line, with the bar full width beneath:
  // the room line lost the time range and the teacher, so it has the space,
  // and the card is one line shorter for it.
  it('puts the countdown on the room line, with the bar beneath', () => {
    const { container } = render(<NowNextCard data={nowNext()} onRoute={() => {}} />);
    const countdown = screen.getByText(/konec za 20 min/);
    expect(countdown.parentElement?.textContent).toContain('cz-room');
    expect(countdown.parentElement?.querySelector('[style*="width"]')).toBeNull();
    expect(container.querySelectorAll('[style*="width: 40%"]')).toHaveLength(1);
  });

  // The time range stays with the agenda row: the bar and the countdown
  // already say how long it runs (device report, Pixel 9a: the card was the
  // wordiest line on screen). The teacher came back on request, in the short
  // form the agenda row uses — the titled full name is what made it wordy.
  it('names the teacher beside the room, short, and leaves the time range to the row', () => {
    const current = makeLesson({
      courseName: 'Počítačové sítě',
      courseNameCs: 'Počítačové sítě',
      room: 'Q03',
      roomCs: 'Q03',
      startTime: '13:00',
      endTime: '14:50',
      teachers: [{ fullName: 'Ing. Igor Grellneth, Ph.D.', shortName: 'I. Grellneth', id: '1' }],
    });
    render(<NowNextCard data={nowNext({ current })} onRoute={() => {}} />);
    const card = screen.getByTestId('now-next-card');
    expect(card.textContent).toContain('Q03');
    expect(card.textContent).not.toMatch(/13:00|14:50/);
    expect(screen.getByText('Q03 · I. Grellneth')).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/Ing\.|Ph\.D\./);
  });

  it('says nothing about what follows when nothing does', () => {
    render(<NowNextCard data={nowNext({ next: null })} onRoute={() => {}} />);
    expect(screen.queryByText(/Následuje/)).not.toBeInTheDocument();
  });

  it('does not label the card "Teď běží"', () => {
    render(<NowNextCard data={nowNext()} onRoute={() => {}} />);
    expect(screen.queryByText(/Teď běží/i)).not.toBeInTheDocument();
    expect(screen.getByText(/konec za 20 min/)).toBeInTheDocument();
  });

  // "Následuje" names what comes and when it starts. The whole range wrapped
  // the row onto a second line at 390px, and the lesson's own row in the
  // agenda right beneath carries it.
  it('heads the following lesson "Následuje", in bold, with when it starts', () => {
    const next = makeLesson({
      courseName: 'Marketing 1',
      courseNameCs: 'Marketing 1',
      room: 'A11',
      roomCs: 'A11',
      startTime: '11:50',
      endTime: '13:20',
    });
    render(<NowNextCard data={nowNext({ next })} onRoute={() => {}} />);
    const label = screen.getByText('Následuje:');
    expect(label.className).toMatch(/font-bold|font-semibold/);
    expect(screen.getByText(/Marketing 1 · A11 · 11:50$/)).toBeInTheDocument();
    expect(screen.queryByText(/13:20/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Pak/)).not.toBeInTheDocument();
  });

  it('CZ mode: shows the Czech localized course name and room for the running lesson', () => {
    render(<NowNextCard data={nowNext()} onRoute={() => {}} />);
    expect(screen.getByText('cz-current')).toBeInTheDocument();
    expect(screen.getByText(/cz-room/)).toBeInTheDocument();
  });

  it('EN mode: shows the English localized course name and room for the running lesson', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<NowNextCard data={nowNext()} onRoute={() => {}} />);
    expect(screen.getByText('en-current')).toBeInTheDocument();
    expect(screen.getByText(/en-room/)).toBeInTheDocument();
  });

  it('EN mode: falls back to the Czech name when the current lesson has no English translation (dual-language contract)', () => {
    useAppStore.setState({ language: 'en' } as never);
    const data = nowNext({
      current: makeLesson({
        courseName: 'base-current',
        courseNameCs: 'cz-current',
        courseNameEn: undefined,
        room: 'base-room',
        roomCs: 'cz-room',
        roomEn: undefined,
      }),
    });
    render(<NowNextCard data={data} onRoute={() => {}} />);
    expect(screen.getByText('cz-current')).toBeInTheDocument();
    expect(screen.queryByText('base-current')).not.toBeInTheDocument();
  });

  it('EN mode: localizes the "next" lesson agenda line too, not just the hero', () => {
    useAppStore.setState({ language: 'en' } as never);
    const data = nowNext({
      next: makeLesson({
        id: 'l2',
        courseName: 'base-next',
        courseNameCs: 'cz-next',
        courseNameEn: 'en-next',
        room: 'base-next-room',
        roomCs: 'cz-next-room',
        roomEn: 'en-next-room',
        startTime: '11:00',
      }),
    });
    render(<NowNextCard data={data} onRoute={() => {}} />);
    expect(screen.getByText(/en-next.*en-next-room/)).toBeInTheDocument();
  });
});

/**
 * "Kam jít" is a promise to point at a place, and the place is the RUNNING
 * lesson's — the one the card is about. It used to route to the next lesson,
 * so a student late for the lecture on now was walked to the one after.
 *
 * It is offered only for a room the map can show: a room the dataset does not
 * carry would send the student to the Map tab and show them nothing.
 */
describe('NowNextCard route button', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  const lessonIn = (room: string, courseName = 'Now') =>
    makeLesson({ courseName, courseNameCs: courseName, room, roomCs: room, roomEn: room });
  const withCurrentRoom = (room: string) => nowNext({ current: lessonIn(room), next: null });

  it.each(['A01', 'Q01'])('offers the route for a running lesson in %s', (room) => {
    render(<NowNextCard data={withCurrentRoom(room)} onRoute={() => {}} />);
    expect(screen.getByRole('button', { name: /Trasa/ })).toBeInTheDocument();
  });

  // T18 and ZFAC1 have a building on the map but no walk to them.
  it.each(['T18', 'ZFAC1', 'B Virtuální 6', 'ucebna_utechov (Sob)'])(
    'withholds the route for a running lesson in %s',
    (room) => {
      render(<NowNextCard data={withCurrentRoom(room)} onRoute={() => {}} />);
      expect(screen.queryByRole('button')).toBeNull();
    }
  );

  // The next lesson's room is not what the button answers for, so a routable
  // next lesson must not conjure the button over an unroutable running one.
  it("ignores the next lesson's room", () => {
    const data = nowNext({ current: lessonIn('ZFAC1'), next: lessonIn('Q01', 'Next') });
    render(<NowNextCard data={data} onRoute={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Beside the lesson it routes to, never on the "Následuje" row, where it
  // would read as a promise about the lesson after.
  it('sits with the running lesson, not on the "Následuje" row', () => {
    const data = nowNext({ current: lessonIn('Q01'), next: lessonIn('A01', 'Next') });
    render(<NowNextCard data={data} onRoute={() => {}} />);
    const button = screen.getByRole('button', { name: /Trasa/ });
    const nextRow = screen.getByText('Následuje:').closest('div');
    expect(nextRow?.contains(button)).toBe(false);
  });

  it('hands the tap to onRoute', () => {
    const onRoute = vi.fn();
    render(<NowNextCard data={withCurrentRoom('Q01')} onRoute={onRoute} />);
    fireEvent.click(screen.getByRole('button', { name: /Trasa/ }));
    expect(onRoute).toHaveBeenCalledOnce();
  });
});

/** The same gap one card higher: an answered event is often what comes next. */
describe('NowNextCard, when an answered society event is next', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapEvents: [
        {
          id: 'evt-1',
          title: 'City Game',
          url: '',
          date: '2026-09-24',
          endDate: null,
          time: '18:30',
          location: null,
          imageUrl: null,
          organizerKey: 'mendelu',
          societyId: 'esn',
          coord: [16.6077, 49.1976],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'other',
        },
      ],
    } as never);
  });

  const cityGame = customEventToLesson({
    id: rsvpBlockId('evt-1'),
    title: 'City Game',
    date: '20260924',
    startTime: '18:30',
    endTime: '20:00',
  });

  it('says where it is when it comes next', () => {
    render(<NowNextCard data={nowNext({ next: cityGame })} onRoute={() => {}} />);
    expect(screen.getByText(/City Game · Místo na mapě · 18:30$/)).toBeInTheDocument();
  });

  // Who runs it rides the teacher's slot, as it does on the agenda row.
  it('says where it is, who runs it, and offers the way there while it runs', () => {
    // "Trasa →" belongs to the running entry (#409). The room index never knows
    // a venue in town, so it is the event's coordinate that makes it routable.
    render(<NowNextCard data={nowNext({ current: cityGame })} onRoute={() => {}} />);
    expect(screen.getByText('Místo na mapě · ESN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trasa/ })).toBeInTheDocument();
  });
});
