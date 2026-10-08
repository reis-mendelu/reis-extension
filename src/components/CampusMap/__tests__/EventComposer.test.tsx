import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';
import type { PostInput } from '../../../api/societyPosts';

const createPost = vi.fn<
  (
    input: PostInput,
    associationId: string,
    createdBy: string
  ) => Promise<{ id?: string; error?: string }>
>(async () => ({ id: 'new' }));
const updatePost = vi.fn<
  (id: string, patch: Record<string, unknown>) => Promise<{ error?: string }>
>(async () => ({}));
vi.mock('../../../api/societyPosts', () => ({
  createPost: (...a: Parameters<typeof createPost>) => createPost(...a),
  updatePost: (...a: Parameters<typeof updatePost>) => updatePost(...a),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';
// The venue box asks Photon about anything two characters or longer; the
// composer tests never want the network.
vi.mock('../../../api/placeSearch', () => ({
  searchPlaces: vi.fn(async () => [
    { id: 'N42', name: 'Bar, který neexistuje', context: 'Brno', coord: [16.6097, 49.1959] },
  ]),
}));
let phone = false;
vi.mock('../../../hooks/ui/usePhoneViewport', () => ({ usePhoneViewport: () => phone }));

beforeEach(() => {
  phone = false;
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

describe('EventComposer publish', () => {
  it('creates an offcampus event with the placed coord', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    // language: 'cs' in beforeEach → labels resolve through the real cs.json
    // translations (not raw keys), so queries below match the rendered Czech text.
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    // choose date through MiniCalendar
    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.coordLng).toBe(16.61);
    // Published under the society being authored, and stamped with the signed-in
    // account's email as created_by.
    expect(createPost.mock.calls[0][1]).toBe('supef');
    expect(createPost.mock.calls[0][2]).toBe('admin@supef.cz');
    // Publishing a live event must refresh the public feed so it shows on the
    // student "Akce" tab without a full reload (stale load-once cache fix).
    expect(useAppStore.getState().reloadMapEvents).toHaveBeenCalled();
    // And the society gets a clear confirmation it worked.
    expect(toast.success).toHaveBeenCalled();
  });

  // A reIS admin authors for a society other than its own. In production that
  // account carries association_id 'reis' (checked against spolky_accounts), so
  // it starts pinned there and the header's picker moves it elsewhere.
  // Publishing must follow the picker, not the account — reading the account
  // field would file every event under 'reis' no matter what was selected.
  it('publishes under the picked society when a reIS admin is signed in', async () => {
    useAppStore.setState({
      adminRole: 'reis_admin',
      // Its own society, as production has it — and deliberately NOT the one
      // being authored, so sending this instead of the picked id is a failure.
      adminAssociationId: 'reis',
      adminActiveAssociationId: 'esn',
      adminSession: { user: { email: 'reis.mendelu@gmail.com' } } as never,
      draftCoord: [16.61, 49.21],
    });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'ESN párty' } });
    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][1]).toBe('esn');
  });

  it('keeps publish disabled until every field is filled, then enables it', async () => {
    render(<EventComposer onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: 'Zveřejnit akci' });
    expect(publish).toBeDisabled();

    // Completing every field enables publish.
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    await waitFor(() => expect(publish).not.toBeDisabled());
  });

  it('publishes with the chosen start time', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // Time: type into the reIS-native combobox — "1930" masks to 19:30.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].time).toBe('19:30');
  });

  it('publishes with the emoji chosen in the picker (not hardcoded party)', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), {
      target: { value: 'Kvíz večer' },
    });
    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    // Open the picker and choose the quiz emoji instead of the default party.
    fireEvent.click(screen.getByRole('button', { name: /Párty/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kvíz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0]).toMatchObject({ emoji: '1f9e0', category: 'quiz' });
  });

  it('preserves venue_kind=campus and room_code when editing a campus event', async () => {
    useAppStore.setState({
      editEventId: 'c1',
      societyMapEvents: [
        {
          id: 'c1',
          title: 'Deskovky',
          url: '',
          date: '2026-07-08',
          endDate: null,
          time: null,
          location: 'Q6.06',
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.614, 49.209],
          roomCode: 'BA39N6006',
          venueKind: 'campus',
          category: 'boardgames',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    // This fixture is a legacy row with time: null. Saving it now requires a
    // start time — that is the point: editing an old event backfills the one
    // field its reminder needs.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    const patch = updatePost.mock.calls[0][1];
    expect(patch.time).toBe('19:30');
    expect(patch.venue_kind).toBe('campus');
    expect(patch.room_code).toBe('BA39N6006');
    expect(patch.category).toBe('boardgames');
  });

  // The backfill files the Finland trip under 'trip' while 🇫🇮 alone maps to
  // 'culture': an edit that leaves the picture alone keeps the event's own.
  it('keeps a trip filed as a trip when an edit leaves its flag alone', async () => {
    useAppStore.setState({
      editEventId: 'c10',
      societyMapEvents: [
        {
          id: 'c10',
          title: 'Trip to Finland',
          url: '',
          date: '2026-07-08',
          endDate: null,
          time: null,
          location: 'Q6.06',
          imageUrl: null,
          organizerKey: 'mendelu',
          societyId: 'esn',
          coord: [16.614, 49.209],
          roomCode: 'BA39N6006',
          venueKind: 'campus',
          category: 'trip',
          emoji: '1f1eb-1f1ee',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1]).toMatchObject({ emoji: '1f1eb-1f1ee', category: 'trip' });
  });

  // An emoji a newer build added is unknown here. Saving an unrelated change
  // must not swap it for this build's fallback, nor re-file the event.
  it('keeps an emoji this build does not ship when saving an edit', async () => {
    useAppStore.setState({
      editEventId: 'c9',
      societyMapEvents: [
        {
          id: 'c9',
          title: 'Flamingo run',
          url: '',
          date: '2026-07-08',
          endDate: null,
          time: null,
          location: 'Q6.06',
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.614, 49.209],
          roomCode: 'BA39N6006',
          venueKind: 'campus',
          category: 'sports',
          emoji: '1f9a9',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1]).toMatchObject({ emoji: '1f9a9', category: 'sports' });
  });

  it('shows the hall name (not the IS code) in the picked-room chip when editing', () => {
    // Campus events save only room_code and a null location, so the chip must
    // resolve BA39N1009 → "Q01" rather than echoing the raw code.
    useAppStore.setState({
      editEventId: 'c2',
      societyMapEvents: [
        {
          id: 'c2',
          title: 'Zootopia',
          url: '',
          date: '2026-07-14',
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.614, 49.209],
          roomCode: 'BA39N1009',
          venueKind: 'campus',
          category: 'party',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByText('Q01')).toBeTruthy();
    expect(screen.queryByText('BA39N1009')).toBeNull();
  });
});

/**
 * Who the event is for, saved as well as chosen.
 *
 * The control is offered when editing, and the form reads the existing value
 * back through `toMapEvent`, so the society sees its choice reflected either
 * way. The patch sent to Supabase left `subscribers_only` out: changing the
 * audience of a published event reported "Uloženo" and changed nothing, and
 * the map went on honouring the old answer while the form showed the new one.
 * The worst shape a bug can take — it looks like it worked.
 */
describe('EventComposer — the audience survives an edit', () => {
  const restricted = {
    id: 'a1',
    title: 'Kvíz v S-klubu',
    url: '',
    date: '2026-07-08',
    endDate: null,
    time: '19:30',
    location: null,
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord: [16.614, 49.209] as [number, number],
    roomCode: 'BA39N6006',
    venueKind: 'campus' as const,
    category: 'quiz' as const,
    subscribersOnly: true,
  };
  const box = () => screen.getByRole('checkbox', { name: 'Jen studenti PEF' });

  it('sends the audience in the patch when it is widened to everyone', async () => {
    useAppStore.setState({ editEventId: 'a1', societyMapEvents: [restricted] } as never);
    render(<EventComposer onDone={() => {}} />);
    expect(box()).toBeChecked();
    fireEvent.click(box());
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1].subscribers_only).toBe(false);
  });

  it('offers no audience control for reIS, which is for everyone', () => {
    useAppStore.setState({ adminActiveAssociationId: 'reis' } as never);
    render(<EventComposer onDone={() => {}} />);
    expect(screen.queryByRole('checkbox', { name: /^Jen / })).toBeNull();
  });

  it('names Erasmus students for ESN', () => {
    useAppStore.setState({ adminActiveAssociationId: 'esn' } as never);
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Jen erasmáci' })).toBeInTheDocument();
  });

  it('sends the audience in the patch when it is narrowed to the faculty', async () => {
    useAppStore.setState({
      editEventId: 'a1',
      societyMapEvents: [{ ...restricted, subscribersOnly: false }],
    } as never);
    render(<EventComposer onDone={() => {}} />);
    expect(box()).not.toBeChecked();
    fireEvent.click(box());
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1].subscribers_only).toBe(true);
  });

  it('carries the stored audience through an edit that does not touch it', async () => {
    // The other half of the same bug: an omitted field is not a preserved one
    // once the form starts sending it, so a title-only edit must not quietly
    // widen a restricted event back to the whole map.
    useAppStore.setState({ editEventId: 'a1', societyMapEvents: [restricted] } as never);
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Kvíz II' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1].title).toBe('Kvíz II');
    expect(updatePost.mock.calls[0][1].subscribers_only).toBe(true);
  });
});

const VENUE = 'Místnost na kampusu nebo místo ve městě…';
const pickRoom = () => {
  fireEvent.change(screen.getByPlaceholderText(VENUE), { target: { value: 'Q01' } });
  const match = screen.getAllByRole('button').find((b) => /^Q01/.test(b.textContent ?? ''));
  fireEvent.click(match as HTMLElement);
};
const fillRequired = () => {
  fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Akce' } });
  fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
  fireEvent.click(screen.getByRole('button', { name: '15' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
};

/**
 * Sprint 08: "Spolky se nemůžou podívat, kde plánují akci na mapě před
 * publikem." The draft pin was never the problem — EventLayer has always drawn
 * one from `draftCoord`. A CAMPUS venue simply never wrote its coordinate
 * there: the room lived in the composer's own useState and the map had nothing
 * to draw, so the only venue kind you could check before publishing was the
 * off-campus one.
 */
describe('EventComposer — seeing the planned location before publishing', () => {
  it('puts a picked campus room on the map as the draft pin', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(useAppStore.getState().draftCoord).toBeNull();

    pickRoom();

    const coord = useAppStore.getState().draftCoord;
    expect(coord).not.toBeNull();
    expect(coord?.[0]).toBeGreaterThan(16);
    expect(coord?.[1]).toBeGreaterThan(49);
  });

  it('takes the pin off the map when the venue is cleared', () => {
    render(<EventComposer onDone={() => {}} />);
    pickRoom();
    expect(useAppStore.getState().draftCoord).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Změnit místo' }));
    expect(useAppStore.getState().draftCoord).toBeNull();
  });

  // Beside the map (the desktop console) the camera just goes there: a bar in
  // town is off-screen from the campus view, and a button to fix that is one
  // more thing to find.
  it('flies the map to a picked venue on its own beside the map', () => {
    render(<EventComposer onDone={() => {}} />);
    const before = useAppStore.getState().draftFocusRequest;
    pickRoom();
    expect(useAppStore.getState().draftFocusRequest).toBe(before + 1);
    expect(screen.queryByRole('button', { name: 'Ukázat na mapě' })).toBeNull();
  });

  // On a phone the map is behind a tab: flying there unasked would yank the
  // society out of a half-filled form, so it gets a button instead.
  it('offers a show-on-map button on a phone instead of switching away', () => {
    phone = true;
    render(<EventComposer onDone={() => {}} />);
    const before = useAppStore.getState().draftFocusRequest;
    pickRoom();
    expect(useAppStore.getState().draftFocusRequest).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: 'Ukázat na mapě' }));
    expect(useAppStore.getState().draftFocusRequest).toBe(before + 1);
  });

  it('has nothing to show before a venue is chosen', () => {
    phone = true;
    render(<EventComposer onDone={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Ukázat na mapě' })).not.toBeInTheDocument();
  });

  // Publishing still has to carry the room's own coordinate, not whatever the
  // store happens to hold — the draft pin is a view of it, not the source.
  it('publishes the room coordinate for a campus event', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    pickRoom();
    // Read the mirrored coord before publishing: closing the composer clears it.
    const pinned = useAppStore.getState().draftCoord;
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('campus');
    expect(input.roomCode).toBeTruthy();
    expect(input.coordLng).toBe(pinned?.[0]);
    expect(input.coordLat).toBe(pinned?.[1]);
  });
});

/**
 * The venue KIND is no longer a question the society answers. It follows from
 * what was picked — a room is a campus event, a searched place or a hand-dropped
 * pin is off campus — so the stale-kind bugs the toggle used to breed (a room's
 * coordinate surviving a switch to "Ve městě") have nothing left to hold on to.
 */
describe('EventComposer — the venue kind follows the pick', () => {
  it('publishes a place from the search as an off-campus event with its name', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    fireEvent.change(screen.getByPlaceholderText(VENUE), { target: { value: 'bar' } });
    fireEvent.click(await screen.findByText('Bar, který neexistuje'));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.roomCode).toBeNull();
    expect(input.location).toBe('Bar, který neexistuje');
    expect(input.coordLng).toBe(16.6097);
  });

  it('turns a campus event into an off-campus one when a place replaces the room', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    pickRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Změnit místo' }));
    fireEvent.change(screen.getByPlaceholderText(VENUE), { target: { value: 'bar' } });
    fireEvent.click(await screen.findByText('Bar, který neexistuje'));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.roomCode).toBeNull();
  });

  it('publishes a hand-dropped pin as an off-campus point', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    expect(screen.getByText('Vybrané místo na mapě')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].venueKind).toBe('offcampus');
    expect(createPost.mock.calls[0][0].location).toBeNull();
  });

  // Kotlářská 51a, pasted from Google Maps: the same venue as a hand-dropped pin.
  it('publishes pasted coordinates as an off-campus point, and pins them on the map', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    pickRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Změnit místo' }));
    fireEvent.change(screen.getByPlaceholderText(VENUE), {
      target: { value: '49.2078989, 16.6030499' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Použít tento bod/ }));
    expect(useAppStore.getState().draftCoord).toEqual([16.6030499, 49.2078989]);
    expect(screen.getByText('Vybrané místo na mapě')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.roomCode).toBeNull();
    expect(input.location).toBeNull();
    expect(input.coordLng).toBe(16.6030499);
    expect(input.coordLat).toBe(49.2078989);
  });
});

/**
 * The draft pin is clickable (EventLayer → beginPlacing) so a society can move
 * a picked venue. That click goes straight to the store, past the composer, so
 * the picked room or place used to survive the move: the form kept saying "Q01"
 * and publish saved the OLD room and its coordinate, whatever the new pin said.
 */
describe('EventComposer — moving the draft pin replaces the pick', () => {
  const movePin = (to: [number, number]) =>
    act(() => {
      useAppStore.getState().beginPlacing();
      useAppStore.getState().placeDraftCoord(to);
    });

  it('publishes the new point, not the old room, after the pin is moved', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    pickRoom();
    movePin([16.7, 49.3]);
    expect(screen.getByText('Vybrané místo na mapě')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.roomCode).toBeNull();
    expect(input.location).toBeNull();
    expect([input.coordLng, input.coordLat]).toEqual([16.7, 49.3]);
  });

  it('drops a searched place’s name once its pin is moved', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    fireEvent.change(screen.getByPlaceholderText(VENUE), { target: { value: 'bar' } });
    fireEvent.click(await screen.findByText('Bar, který neexistuje'));
    movePin([16.7, 49.3]);
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.location).toBeNull();
    expect([input.coordLng, input.coordLat]).toEqual([16.7, 49.3]);
  });

  it('keeps the room when placing is started and then cancelled', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    pickRoom();
    act(() => {
      useAppStore.getState().beginPlacing();
      useAppStore.getState().cancelPlacing();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].venueKind).toBe('campus');
    expect(createPost.mock.calls[0][0].roomCode).toBeTruthy();
  });

  // openComposer seeds draftCoord from the edited event, so an untouched
  // campus event must still read as its room, not as a bare point.
  it('saves an untouched campus event as campus when draftCoord mirrors it', async () => {
    const coord: [number, number] = [16.614, 49.209];
    useAppStore.setState({
      editEventId: 'c1',
      draftCoord: [...coord],
      societyMapEvents: [
        {
          id: 'c1',
          title: 'Deskovky',
          url: '',
          date: '2026-07-08',
          endDate: null,
          time: '19:30',
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord,
          roomCode: 'BA39N6006',
          venueKind: 'campus',
          category: 'boardgames',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1].venue_kind).toBe('campus');
    expect(updatePost.mock.calls[0][1].room_code).toBe('BA39N6006');
  });
});

/**
 * Every event had only a title — the form saved `body: ''` unconditionally —
 * so societies packed the details into it: "City Game (bring a pen)", "BYO
 * Picnic (B - bring, Y - your, O - own)". The description is optional.
 */
describe('EventComposer — a description', () => {
  it('publishes what the society wrote', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    fireEvent.change(screen.getByRole('textbox', { name: 'Popis (nepovinný)' }), {
      target: { value: '  Vezměte si propisku.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].body).toBe('Vezměte si propisku.');
  });

  it('reads the description back when editing and saves a change to it', async () => {
    useAppStore.setState({
      editEventId: 'd1',
      draftCoord: [16.61, 49.21],
      societyMapEvents: [
        {
          id: 'd1',
          title: 'City Game',
          description: 'Vezměte si propisku.',
          url: '',
          date: '2026-07-08',
          endDate: null,
          time: '18:00',
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.61, 49.21],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'culture',
        },
      ],
    } as never);
    render(<EventComposer onDone={() => {}} />);
    const field = screen.getByRole('textbox', { name: 'Popis (nepovinný)' });
    expect(field).toHaveValue('Vezměte si propisku.');
    fireEvent.change(field, { target: { value: 'Sraz u Q.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1].body).toBe('Sraz u Q.');
  });
});

describe('EventComposer — the picture a society usually picks', () => {
  it('starts on the emoji of the society’s latest event', () => {
    useAppStore.setState({
      draftCoord: [16.61, 49.21],
      societyPosts: [
        { id: 'p1', date: '2026-07-01', category: 'party', emoji: null },
        { id: 'p2', date: '2026-07-20', category: 'boardgames', emoji: null },
      ],
    } as never);
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: /Deskovky/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('starts on Párty for a society that has never posted', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: /Párty/ })).toBeInTheDocument();
  });
});

/**
 * Deskovky every Thursday: the second one should not be typed from scratch.
 * A duplicate is a NEW event — it creates, never updates the original — with
 * everything carried over except the date, which is the one thing that has to
 * change.
 */
describe('EventComposer — duplicating an event', () => {
  const source = {
    id: 's1',
    title: 'Deskovky',
    description: 'Hry máme, přineste chuť.',
    url: 'https://example.org/deskovky',
    date: '2026-07-08',
    endDate: null,
    time: '18:00',
    location: 'Klub Fléda',
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord: [16.6, 49.2] as [number, number],
    roomCode: null,
    venueKind: 'offcampus' as const,
    category: 'boardgames' as const,
    subscribersOnly: true,
  };

  it('prefills everything but the date, and publishes a new event', async () => {
    useAppStore.setState({
      duplicateEventId: 's1',
      draftCoord: source.coord,
      societyMapEvents: [source],
    } as never);
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByPlaceholderText('Název akce')).toHaveValue('Deskovky');
    expect(screen.getAllByText('Vyberte datum')[0]).toBeInTheDocument();
    const publish = screen.getByRole('button', { name: 'Zveřejnit akci' });
    expect(publish).toBeDisabled();

    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    fireEvent.click(publish);

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(updatePost).not.toHaveBeenCalled();
    const input = createPost.mock.calls[0][0];
    expect(input).toMatchObject({
      title: 'Deskovky',
      body: 'Hry máme, přineste chuť.',
      time: '18:00',
      category: 'boardgames',
      venueKind: 'offcampus',
      location: 'Klub Fléda',
      url: 'https://example.org/deskovky',
      subscribersOnly: true,
    });
    expect(input.date).not.toBe('2026-07-08');
  });
});

/**
 * A society publishes what it knows. A semester list has a title and a date;
 * the place and time follow later — venue_kind 'tba', time null — rather than
 * a start time or a venue being required up front.
 */
describe('EventComposer — publishing without a place or time', () => {
  const fillTitleAndDate = () => {
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Kvíz' } });
    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
  };

  it('enables publish with only a title and a date', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeDisabled();
    fillTitleAndDate();
    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeEnabled();
  });

  it('publishes the time rather than a null when one is set', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fillTitleAndDate();
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].time).toBe('19:30');
  });

  it('publishes with only a title and a date, as venue_kind tba with no time', async () => {
    render(<EventComposer onDone={() => {}} />);
    fillTitleAndDate();
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('tba');
    expect(input.time).toBeNull();
    expect(input.roomCode).toBeNull();
    expect(input.coordLng).toBeNull();
    expect(input.coordLat).toBeNull();
    expect(input.location).toBeNull();
  });
});

/**
 * `url` is optional, but when it's filled in it becomes an <a href> in
 * EventDetailCard and openExternal — a `javascript:` scheme there would run
 * in the page. Only http(s) links validateExternalUrl accepts get through.
 */
// Two identical "Vyberte datum" triggers used to be all a screen reader got:
// each date picker is now named by its own heading.
describe('EventComposer — the two date pickers', () => {
  it('names each date trigger by its heading', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Kdy Vyberte datum' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Konec (vícedenní akce) Vyberte datum' })
    ).toBeInTheDocument();
  });
});

describe('EventComposer — url validation', () => {
  const fillRequired = () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Kvíz' } });
    fireEvent.click(screen.getAllByText('Vyberte datum')[0]);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
  };

  it('disables publish and shows an inline error for a javascript: url', () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'javascript:alert(1)' },
    });

    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeDisabled();
    expect(screen.getByText('Zadej odkaz http:// nebo https://')).toBeInTheDocument();
  });

  // The error is not only red text: a screen reader hears it on the field.
  it('ties the url error to its input for assistive technology', () => {
    render(<EventComposer onDone={() => {}} />);
    const input = screen.getByPlaceholderText('https://…');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Zadej odkaz http:// nebo https://');
  });

  it('leaves publish enabled when the url field is left empty', () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeEnabled();
  });

  // `form-control` and
  // `label-text` are both DaisyUI 4; daisyui@5.7.22 defines neither, so the
  // <label> kept its default `display: inline` and its <span> shared a line
  // box with the control. The url input carries no width of its own beyond
  // daisyUI's `clamp(3rem, 20rem, 100%)`, so as soon as the composer was
  // wider than roughly 440px the 20rem input fitted beside the label and rode
  // up over it — measured at -22.7px of overlap at 1024px, the iPad landscape
  // width the phone tree is shipped at. The phone widths hid it: there the
  // 20rem cap already exceeded the container, so the input wrapped by luck.
  //
  // verify-ui's collision probe cannot catch this — it compares text-bearing
  // boxes, and an <input> placeholder is not a DOM text node.
  it('stacks the url label above its input rather than relying on the removed form-control class', () => {
    render(<EventComposer onDone={() => {}} />);
    const urlInput = screen.getByPlaceholderText('https://…');
    const wrapper = urlInput.closest('label');

    expect(wrapper?.className).toMatch(/(^|\s)flex(\s|$)/);
    expect(wrapper?.className).toMatch(/flex-col/);
    // The 20rem cap is what let the input share the label's line box, and it
    // also made this the one control in the composer narrower than its
    // siblings. w-full removes both problems.
    expect(urlInput.className).toMatch(/w-full/);
    // Neither dead DaisyUI 4 class may come back.
    expect(wrapper?.className).not.toMatch(/form-control/);
    expect(wrapper?.querySelector('span')?.className).not.toMatch(/label-text/);
  });
});

/**
 * reIS has no narrower audience, so the composer shows no control for it — and
 * an edit must not quietly keep a legacy restricted flag it cannot clear.
 */
describe('EventComposer — reIS cannot restrict', () => {
  it('clears a legacy restricted flag on save', async () => {
    const legacy = {
      id: 'r1',
      title: 'reIS meetup',
      url: '',
      date: '2026-07-08',
      endDate: null,
      time: '19:30',
      location: null,
      imageUrl: null,
      organizerKey: 'mendelu',
      societyId: 'reis',
      coord: [16.614, 49.209] as [number, number],
      roomCode: 'BA39N6006',
      venueKind: 'campus' as const,
      category: 'quiz' as const,
      subscribersOnly: true,
    };
    useAppStore.setState({
      adminActiveAssociationId: 'reis',
      editEventId: 'r1',
      societyMapEvents: [legacy],
    } as never);
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1].subscribers_only).toBe(false);
  });
});

describe('EventComposer — a society the catalog does not know', () => {
  it('keeps a stored restriction rather than clearing it blind', async () => {
    const row = {
      id: 'g1',
      title: 'Ghost event',
      url: '',
      date: '2026-07-08',
      endDate: null,
      time: '19:30',
      location: null,
      imageUrl: null,
      organizerKey: 'pef',
      societyId: 'ghost',
      coord: [16.614, 49.209] as [number, number],
      roomCode: 'BA39N6006',
      venueKind: 'campus' as const,
      category: 'quiz' as const,
      subscribersOnly: true,
    };
    useAppStore.setState({
      adminActiveAssociationId: 'ghost',
      editEventId: 'g1',
      societyMapEvents: [row],
    } as never);
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    expect(updatePost.mock.calls[0][1].subscribers_only).toBe(true);
  });
});
