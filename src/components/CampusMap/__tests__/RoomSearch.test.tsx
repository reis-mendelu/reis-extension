import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../api/campusMap', () => ({ fetchBuildingRooms: vi.fn() }));
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomSearch } from '../RoomSearch';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => useAppStore.setState({ mapSearchQuery: '', mapSearchResults: [], activeBuildingId: null }));

describe('RoomSearch', () => {
  it('shows results as the user types and focuses on click', async () => {
    render(<RoomSearch />);
    // Substituted from the brief's "Q01" query: the bundled room index has many "Q01.NN" rooms
    // whose `code` field (BA39P1009, etc.) doesn't contain "Q01" and sorts before this one, so a
    // plain "Q01" query never renders matching text within the 12-result limit. "Q01.58" is a
    // building-0 room whose `code === name === "Q01.58"`, making it a unique, renderable match.
    await userEvent.type(screen.getByRole('textbox'), 'Q01.58');
    const hit = await screen.findByText(/Q01\.58/);
    await userEvent.click(hit);
    expect(useAppStore.getState().activeBuildingId).toBe(0); // Q
  });
});
