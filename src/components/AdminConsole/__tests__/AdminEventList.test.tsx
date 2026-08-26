import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';

// Captured before any test swaps it for a spy.
const realCloseComposer = useAppStore.getState().closeComposer;
import { AdminEventList } from '../AdminEventList';
import type { MapEvent } from '../../../types/events';

vi.mock('../../../api/societyPosts', () => ({ deletePost: vi.fn().mockResolvedValue({}) }));
import { deletePost } from '../../../api/societyPosts';
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

const mk = (id: string, date: string): MapEvent => ({
  id,
  title: `E-${id}`,
  url: '',
  date,
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: [16.6, 49.2],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
});

describe('AdminEventList', () => {
  beforeEach(() => {
    // NOW is real; pick dates relative to today so the buckets are deterministic.
    const today = new Date();
    const iso = (d: number) => {
      const t = new Date(today);
      t.setDate(t.getDate() + d);
      return t.toISOString().slice(0, 10);
    };
    useAppStore.setState({
      adminConsoleOpen: true,
      adminActiveAssociationId: 'supef',
      language: 'en',
      // Reset with the rest. Tests below set each of these and nothing put them
      // back, so in a shuffled run a later test inherited another's role or an
      // open composer. closeComposer is an ACTION swapped for a spy, which stays
      // swapped for the whole file unless the real one is restored.
      adminRole: null,
      composerOpen: false,
      closeComposer: realCloseComposer,
      // NOTE: the third fixture uses id 'old' rather than 'past' — a title of
      // "E-past" would collide with the "Past" section heading under a
      // case-insensitive /past/i text match (getByText would find two nodes).
      societyMapEvents: [mk('old', iso(-3)), mk('live', iso(2)), mk('sched', iso(30))],
    });
  });

  it('groups own events into Live / Scheduled / Past', () => {
    render(<AdminEventList />);
    expect(screen.getByText('E-live')).toBeInTheDocument();
    expect(screen.getByText('E-sched')).toBeInTheDocument();
    expect(screen.getByText('E-old')).toBeInTheDocument();
    // headings present
    expect(screen.getByText(/live now/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/past/i)).toBeInTheDocument();
  });

  // A reIS admin lands here belonging to no society. Showing an empty list would
  // read as "this society has no events" rather than "you haven't picked one".
  it('prompts a reIS admin to pick a society instead of listing nothing', () => {
    useAppStore.setState({
      language: 'en',
      adminRole: 'reis_admin',
      adminActiveAssociationId: null,
      societyMapEvents: [],
    });
    render(<AdminEventList />);
    expect(screen.getByText(/choose a society/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create event' })).toBeNull();
  });
});

describe('AdminEventList — rows, inline composer, delete', () => {
  beforeEach(() => {
    // Real strings, not translation keys: useTranslation() is not mocked in this
    // suite. With language 'cz', "map.createEvent" renders as "Vytvořit akci"
    // and the composer's name input placeholder is "Název akce" — query those
    // literal strings, not the i18n keys.
    useAppStore.setState({
      language: 'cz',
      adminConsoleOpen: true,
      adminRole: 'association',
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
      composerOpen: false,
      editEventId: null,
      societyMapEvents: [
        {
          id: 'e1',
          title: 'Spring Party',
          url: '',
          date: '2026-07-10',
          endDate: null,
          time: '20:00',
          location: 'Klub',
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.6, 49.2],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
      ],
      openComposer: vi.fn(),
      loadSocietyPosts: vi.fn(async () => {}),
      clearMapSelection: vi.fn(),
    });
    vi.clearAllMocks();
  });

  it('renders own events as rich rows with the thumbnail', () => {
    render(<AdminEventList />);
    expect(screen.getByText('Spring Party')).toBeInTheDocument();
    expect(document.querySelector('img[src="/emoji/1f389.svg"]')).toBeTruthy();
  });

  it('Create calls openComposer with no id', () => {
    const openComposer = vi.fn();
    useAppStore.setState({ openComposer });
    render(<AdminEventList />);
    screen.getByRole('button', { name: 'Vytvořit akci' }).click();
    expect(openComposer).toHaveBeenCalledWith();
  });

  it('shows the inline composer when composerOpen', () => {
    useAppStore.setState({ composerOpen: true, closeComposer: vi.fn() });
    render(<AdminEventList />);
    expect(screen.getByPlaceholderText('Název akce')).toBeInTheDocument();
    // The events list is hidden while composing so the composer is the sole
    // focus — no redundant empty-state or half-scrolled rows below the form.
    expect(screen.queryByText('Spring Party')).toBeNull();
  });

  it('hides the Create bar while composing to save space', () => {
    useAppStore.setState({ composerOpen: false });
    const { rerender } = render(<AdminEventList />);
    expect(screen.getByRole('button', { name: 'Vytvořit akci' })).toBeInTheDocument();
    useAppStore.setState({ composerOpen: true, closeComposer: vi.fn() });
    rerender(<AdminEventList />);
    // …hidden once the composer takes over (it has its own header).
    expect(screen.queryByRole('button', { name: 'Vytvořit akci' })).toBeNull();
  });

  it('has no logout in the list column (it lives in the console header)', () => {
    render(<AdminEventList />);
    expect(screen.queryByRole('button', { name: 'Odhlásit' })).toBeNull();
  });

  it('row Edit opens the composer for that event (authoring stays in the column)', () => {
    const openComposer = vi.fn();
    useAppStore.setState({ openComposer });
    render(<AdminEventList />);
    fireEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    expect(openComposer).toHaveBeenCalledWith('e1');
  });

  it('row Delete arms an in-row confirm, then commits deletePost + reload', async () => {
    const loadSocietyPosts = vi.fn(async () => {});
    const reloadMapEvents = vi.fn(async () => {});
    useAppStore.setState({ loadSocietyPosts, reloadMapEvents });
    render(<AdminEventList />);
    // Arm: the trash swaps to a confirm (✓) / cancel (✗) pair, no request yet.
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(deletePost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Opravdu smazat?' }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('e1'));
    expect(loadSocietyPosts).toHaveBeenCalled();
    // Deleting changes the public feed too — refresh it so the pin disappears
    // from the student "Akce" view without a full reload.
    expect(reloadMapEvents).toHaveBeenCalled();
    // Confirm the deletion so the society knows it took effect.
    expect(toast.success).toHaveBeenCalled();
  });

  it('Cancel disarms the delete confirm without calling deletePost', () => {
    render(<AdminEventList />);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(deletePost).not.toHaveBeenCalled();
    // Back to the resting Edit/Delete affordances.
    expect(screen.getByRole('button', { name: 'Smazat' })).toBeInTheDocument();
  });
});
