import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { RoomThumbnail } from '../RoomThumbnail';

/**
 * `RoomThumbnail` used to call `loadMapBuilding` from a `useEffect` whenever the
 * geometry it wanted was not in the store yet — the one thing the Iron Rules say
 * a component must not do ("NO `useEffect` for data fetching — fetch in
 * services/store, not components").
 *
 * The intent behind that fetch is a hover, not a render, so it now belongs to
 * the event that expresses it: `MapHoverCard` asks the store for the geometry
 * when it reveals the card, and this component reads synchronously from
 * whatever is there. These tests pin the split, because a component that
 * fetches on render looks identical to one that does not until the store is
 * watched.
 */
const loadMapBuilding = vi.fn();
const loadRoomGeometry = vi.fn();

beforeEach(() => {
  loadMapBuilding.mockClear();
  loadRoomGeometry.mockClear();
  useAppStore.setState({ roomsByBuilding: {}, loadMapBuilding, loadRoomGeometry });
});

describe('RoomThumbnail', () => {
  it('fetches nothing when the geometry is missing — it waits', () => {
    // "A01" resolves (building 54678) while the store holds no geometry, which
    // is exactly the state the old effect used to fire in.
    render(<RoomThumbnail roomName="A01" />);
    expect(loadMapBuilding).not.toHaveBeenCalled();
    expect(loadRoomGeometry).not.toHaveBeenCalled();
  });

  it('shows the spinner while it waits, rather than an empty box', () => {
    const { container } = render(<RoomThumbnail roomName="A01" />);
    expect(container.querySelector('.loading')).not.toBeNull();
  });

  it('fetches nothing for a room the map cannot find either', () => {
    render(<RoomThumbnail roomName="X02" />);
    expect(loadMapBuilding).not.toHaveBeenCalled();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
