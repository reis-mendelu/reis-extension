import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NowNextCard } from '../NowNextCard';
import { useAppStore } from '../../../../../store/useAppStore';
import { makeLesson } from '../../../../../test/fixtures/lesson';
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
