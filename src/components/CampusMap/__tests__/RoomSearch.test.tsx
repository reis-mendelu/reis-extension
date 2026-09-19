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
    // Results render the human-friendly `name` (e.g. "Q01.09"), never the opaque
    // passport `code` (BA39P1009). So a plain "Q01" query — what a student actually
    // types — surfaces readable matches and focuses the right building on click.
    await userEvent.type(screen.getByRole('textbox'), 'Q01');
    const hits = await screen.findAllByText(/^Q01/);
    expect(hits.length).toBeGreaterThan(0);
    await userEvent.click(hits[0]);
    expect(useAppStore.getState().activeBuildingId).toBe(0); // Q
  });
});
