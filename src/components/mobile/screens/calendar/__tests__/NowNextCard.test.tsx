import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  // A row of its own above the title left a band of empty card; on the title's
  // line it pushed a real course name onto two lines. It belongs beside the
  // bar that shows the same thing.
  it('puts the countdown beside the progress bar', () => {
    const { container } = render(<NowNextCard data={nowNext()} onRoute={() => {}} />);
    const countdown = screen.getByText(/konec za 20 min/);
    expect(countdown.parentElement?.querySelector('.rounded-full')).toBeTruthy();
    expect(container.querySelectorAll('[style*="width: 40%"]')).toHaveLength(1);
  });

  it('says nothing about what follows when nothing does', () => {
    render(<NowNextCard data={nowNext({ next: null })} onRoute={() => {}} />);
    expect(screen.queryByText(/Následuje/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trasa/ })).not.toBeInTheDocument();
  });

  it('does not label the card "Teď běží"', () => {
    render(<NowNextCard data={nowNext()} onRoute={() => {}} />);
    expect(screen.queryByText(/Teď běží/i)).not.toBeInTheDocument();
    expect(screen.getByText(/konec za 20 min/)).toBeInTheDocument();
  });

  // "Pak:" with a bare start time left the obvious question open — until when?
  it('heads the following lesson "Následuje", in bold, with the whole time it runs', () => {
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
    expect(screen.getByText(/Marketing 1 · A11 · 11:50 – 13:20/)).toBeInTheDocument();
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
 * "Kam jít" is a promise to point at a place. It used to render for every
 * next lesson, so a room the dataset does not carry sent the student to the
 * Map tab and showed them nothing — the same dead control the agenda pin had.
 */
describe('NowNextCard route button', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  const withNextRoom = (room: string) =>
    nowNext({ next: makeLesson({ courseName: 'Next', room, roomCs: room, roomEn: room }) });

  it.each(['A01', 'Q01'])('offers the route for %s', (room) => {
    render(<NowNextCard data={withNextRoom(room)} onRoute={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it.each(['X02', 'B Virtuální 6'])('withholds the route for %s', (room) => {
    render(<NowNextCard data={withNextRoom(room)} onRoute={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
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

  it('says where it is and offers the way there', () => {
    const next = customEventToLesson({
      id: rsvpBlockId('evt-1'),
      title: 'City Game',
      date: '20260924',
      startTime: '18:30',
      endTime: '20:00',
    });
    render(<NowNextCard data={nowNext({ next })} onRoute={() => {}} />);
    expect(screen.getByText(/City Game · Místo na mapě · 18:30 – 20:00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trasa/ })).toBeInTheDocument();
  });
});
