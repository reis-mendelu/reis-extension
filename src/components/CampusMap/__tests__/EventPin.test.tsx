import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventPin } from '../EventPin';
import type { VenueGroup } from '../eventHelpers';
import type { MapEvent, EventCategory } from '../../../types/events';

function ev(id: string, category: EventCategory, title = id): MapEvent {
  return {
    id, title, url: '', date: '2026-11-04', endDate: null, time: '17:00',
    location: 'Q23', imageUrl: null, organizerKey: 'pef', societyId: 'supef',
    coord: [16.614247, 49.209592], roomCode: 'Q23', venueKind: 'campus', category,
  };
}
function group(events: MapEvent[]): VenueGroup {
  return { key: 'k', coord: [16.614247, 49.209592], events };
}

describe('EventPin', () => {
  it('renders the category emoji image as the pin face', () => {
    const { container } = render(
      <EventPin group={group([ev('Deskovky', 'boardgames')])} x={100} y={100} selected={false} locale="en-US" onSelect={() => {}} />,
    );
    // A real full-colour emoji (bundled Twemoji svg) is the whole pin face.
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/emoji/1f3b2.svg'); // 🎲 boardgames
  });

  it('paints no count badge on the pin face; co-located events surface as "+N" in the hover bubble', () => {
    const { rerender } = render(
      <EventPin group={group([ev('a', 'party')])} x={0} y={0} selected={false} locale="en-US" onSelect={() => {}} />,
    );
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.queryByText(/\+1/)).toBeNull();
    rerender(
      <EventPin group={group([ev('a', 'party'), ev('b', 'quiz')])} x={0} y={0} selected={false} locale="en-US" onSelect={() => {}} />,
    );
    // No always-on "2" badge — the extra event is summarised as "+1" in the bubble.
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.getByText(/\+1/)).toBeTruthy();
  });
});
