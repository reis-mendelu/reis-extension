import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';
import type { PostInput } from '../../../api/societyPosts';

const createPost = vi.fn<
  (input: PostInput, associationId: string, createdBy: string) => Promise<{ id?: string }>
>(async () => ({ id: 'new' }));
vi.mock('../../../api/societyPosts', () => ({
  createPost: (...a: Parameters<typeof createPost>) => createPost(...a),
  updatePost: vi.fn(async () => ({})),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../api/placeSearch', () => ({
  searchPlaces: vi.fn(async () => [
    { id: 'N42', name: 'Bar, který neexistuje', context: 'Brno', coord: [16.6097, 49.1959] },
  ]),
}));
vi.mock('../../../hooks/ui/usePhoneViewport', () => ({ usePhoneViewport: () => false }));

const VENUE = 'Místnost na kampusu nebo místo ve městě…';
const FIELD = 'Název místa';

beforeEach(() => {
  createPost.mockClear();
  useAppStore.setState({
    language: 'cz',
    adminAssociationId: 'usaf',
    adminActiveAssociationId: 'usaf',
    adminSession: { user: { email: 'admin@usaf.cz' } } as never,
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

const publish = async () => {
  fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Grill' } });
  fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
  fireEvent.click(screen.getByRole('button', { name: '15' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
  fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
  await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
  return createPost.mock.calls[0][0];
};

// A place the search cannot find ("Yak"): the society drops the pin and names
// it by hand. Without the name the card said "Vybrané místo na mapě".
describe('EventComposer — naming a pin', () => {
  it('offers no name field until there is a pin', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(screen.queryByLabelText(FIELD)).toBeNull();
  });

  it('saves the typed name as the location of a hand-dropped pin', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '  Yak ' } });
    const input = await publish();
    expect(input.venueKind).toBe('offcampus');
    expect(input.location).toBe('Yak');
    expect(input.coordLng).toBe(16.61);
  });

  it('leaves the location empty when no name is typed', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    expect((await publish()).location).toBeNull();
  });

  it('keeps the typed name when the pin is moved', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'Yak' } });
    act(() => useAppStore.getState().placeDraftCoord([16.62, 49.22]));
    const input = await publish();
    expect(input.location).toBe('Yak');
    expect(input.coordLng).toBe(16.62);
  });

  it('prefills a searched place with its name and lets it be corrected', async () => {
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(VENUE), { target: { value: 'bar' } });
    fireEvent.click(await screen.findByText('Bar, který neexistuje'));
    expect((screen.getByLabelText(FIELD) as HTMLInputElement).value).toBe('Bar, který neexistuje');
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'Yak' } });
    expect((await publish()).location).toBe('Yak');
  });

  it('drops the name of a searched place when the field is cleared', async () => {
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(VENUE), { target: { value: 'bar' } });
    fireEvent.click(await screen.findByText('Bar, který neexistuje'));
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '' } });
    const input = await publish();
    expect(input.location).toBeNull();
    expect(input.venueKind).toBe('offcampus');
  });
});
