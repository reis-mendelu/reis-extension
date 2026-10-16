import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';
import type { PostInput } from '../../../api/societyPosts';
import type { MapEvent } from '../../../types/events';

const createPost = vi.fn<
  (input: PostInput, associationId: string, createdBy: string) => Promise<{ id?: string }>
>(async () => ({ id: 'new' }));
const updatePost = vi.fn<(id: string, patch: Record<string, unknown>) => Promise<object>>(
  async () => ({})
);
vi.mock('../../../api/societyPosts', () => ({
  createPost: (...a: Parameters<typeof createPost>) => createPost(...a),
  updatePost: (...a: Parameters<typeof updatePost>) => updatePost(...a),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';
vi.mock('../../../api/placeSearch', () => ({ searchPlaces: vi.fn(async () => []) }));
vi.mock('../../../hooks/ui/usePhoneViewport', () => ({ usePhoneViewport: () => false }));

const notice: MapEvent = {
  id: 'n1',
  title: 'Hledáš bydlení v Brně?',
  url: 'https://example.org/form',
  date: '2026-10-20',
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'mendelu',
  societyId: 'supef',
  coord: null,
  roomCode: null,
  venueKind: 'tba',
  category: 'other',
  kind: 'notice',
};

beforeEach(() => {
  createPost.mockClear();
  updatePost.mockClear();
  useAppStore.setState({
    language: 'cz',
    adminAssociationId: 'supef',
    adminActiveAssociationId: 'supef',
    adminSession: { user: { email: 'admin@supef.cz' } } as never,
    draftCoord: null,
    editEventId: null,
    duplicateEventId: null,
    societyPosts: [],
    composerOpen: true,
    societyMapEvents: [],
    loadSocietyPosts: vi.fn(async () => {}),
    reloadMapEvents: vi.fn(async () => {}),
  });
});

const pickDate = () => {
  fireEvent.click(screen.getAllByText('Vyberte datum').at(0)!);
  fireEvent.click(screen.getByRole('button', { name: '15' }));
};

describe('EventComposer — event or notice', () => {
  it('starts as an event, with the venue field', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Akce' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Kde')).toBeInTheDocument();
  });

  // A notice is never on the map, so asking where it is would be a lie.
  it('a notice hides the venue, the picture and the description, and keeps the date and the link', () => {
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Oznámení' }));
    expect(screen.getByRole('button', { name: 'Oznámení' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.queryByText('Kde')).not.toBeInTheDocument();
    expect(screen.queryByText('Obrázek akce')).not.toBeInTheDocument();
    expect(screen.getAllByText('Vyberte datum').length).toBeGreaterThan(0);
    expect(screen.getByText(/Jen v Novinkách/)).toBeInTheDocument();
    // Novinky shows a notice's title and opens its link; a description would
    // be asked for and never shown, so it is not asked, and the hint says so.
    expect(screen.queryByText('Popis (nepovinný)')).not.toBeInTheDocument();
    expect(screen.getByText(/Studenti uvidí název a odkaz/)).toBeInTheDocument();
    // A notice's end date is how long Novinky keeps it, not a multi-day event.
    expect(screen.getByText('Zobrazovat do (nepovinné)')).toBeInTheDocument();
    expect(screen.queryByText('Konec (vícedenní akce)')).not.toBeInTheDocument();
  });

  it('publishes a notice as a notice, with no place', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] }); // a pin dropped before the switch
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Oznámení' }));
    fireEvent.change(screen.getByPlaceholderText('Název oznámení'), {
      target: { value: 'Bydlení' },
    });
    pickDate();
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit oznámení' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls.at(0)?.[0]).toMatchObject({
      kind: 'notice',
      venueKind: 'tba',
      coordLng: null,
    });
    // Not "Akce zveřejněna": it was not an event.
    expect(toast.success).toHaveBeenCalledWith('Oznámení zveřejněno');
  });

  it('opens an existing notice as a notice, and an edit can turn it into an event', async () => {
    useAppStore.setState({ editEventId: 'n1', societyMapEvents: [notice] });
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByText('Upravit oznámení')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oznámení' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Akce' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls.at(0)?.[1].kind).toBe('event');
  });

  it('a duplicate of a notice is a notice', () => {
    useAppStore.setState({ duplicateEventId: 'n1', societyMapEvents: [notice] });
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Oznámení' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
