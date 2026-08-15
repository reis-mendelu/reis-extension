import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PersonSheet } from '../PersonSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { BlockLesson } from '../../../../types/calendarTypes';

const openTeamsChat = vi.hoisted(() => vi.fn());
vi.mock('../../../../mobile/teamsLink', () => ({ openTeamsChat }));

const usePersonPhoto = vi.hoisted(() => vi.fn(() => null as string | null));
vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto }));

const PHOTO = 'data:image/jpeg;base64,AAAA';

const taughtLesson: BlockLesson = {
  id: 'ev1',
  date: '20260401',
  startTime: '10:00',
  endTime: '11:50',
  courseName: 'Algoritmizace',
  courseCode: 'ALG',
  courseId: '159410',
  room: 'Q01 (Poříčí)',
  roomStructured: { name: 'Q01', id: 'Q01' },
  teachers: [{ fullName: 'Jan Novák', shortName: 'Novák', id: '42' }],
  periodId: '1',
  studyId: '1',
  campus: 'Poříčí',
  isDefaultCampus: 'true',
  facultyCode: 'PEF',
  isSeminar: 'false',
  isConsultation: 'false',
  isExam: false,
};

describe('PersonSheet', () => {
  const setMobileTab = vi.fn();
  const focusRoomByCode = vi.fn();

  beforeEach(() => {
    setMobileTab.mockClear();
    focusRoomByCode.mockClear();
    openTeamsChat.mockClear();
    usePersonPhoto.mockReturnValue(null);
    useAppStore.setState({
      language: 'cz',
      schedule: { data: [taughtLesson], status: 'success' },
      personProfiles: {
        42: {
          data: {
            personId: 42,
            name: 'Jan Novák',
            universityEmail: 'novak@mendelu.cz',
            privateEmail: null,
            programmeCode: null,
            programmeName: null,
            studyTypeSentence: 'Vyučující',
            yearSemesterSentence: null,
          },
          fetchedAt: Date.now(),
          lang: 'cz',
        },
      },
      personProfilesLoading: {},
      setMobileTab,
      focusRoomByCode,
    } as never);
  });

  it('shows the person name and email', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('novak@mendelu.cz')).toBeInTheDocument();
  });

  it('copies the address to the clipboard when the email row is tapped', async () => {
    // A mailto: on a phone throws the student into whichever mail client the OS
    // picked years ago. The address itself is what they actually want — to paste
    // into Outlook, into Teams, into a form.
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('novak@mendelu.cz'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('novak@mendelu.cz'));
    expect(await screen.findByText('Zkopírováno!')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('opens a Teams chat with the person', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Napsat na Teams'));
    expect(openTeamsChat).toHaveBeenCalledWith('novak@mendelu.cz');
  });

  it('maximises the photo when the avatar is tapped', () => {
    // Pushed onto the sheet STACK rather than shown inline, which is what makes
    // Android's back close the photo and leave the person open.
    const pushSheet = vi.fn();
    useAppStore.setState({ pushSheet } as never);
    usePersonPhoto.mockReturnValue(PHOTO);

    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Zvětšit fotku'));

    expect(pushSheet).toHaveBeenCalledWith({
      kind: 'personPhoto',
      personId: '42',
      name: 'Jan Novák',
    });
  });

  it('does not offer to maximise initials when there is no photo', () => {
    usePersonPhoto.mockReturnValue(null);
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Zvětšit fotku')).not.toBeInTheDocument();
    expect(screen.getByText('JN')).toBeInTheDocument();
  });

  it('offers no Teams button for someone with only a private address', () => {
    // Teams resolves people inside the university tenant. A gmail address is
    // not one, so the button would open an empty search — the copy row is all
    // this profile can honestly offer.
    useAppStore.setState({
      personProfiles: {
        42: {
          data: {
            personId: 42,
            name: 'Jan Novák',
            universityEmail: null,
            privateEmail: 'novak@gmail.com',
          },
          fetchedAt: Date.now(),
          lang: 'cz',
        },
      },
    } as never);
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);

    expect(screen.getByText('novak@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText('Napsat na Teams')).not.toBeInTheDocument();
  });

  it("deep-links to the map at their taught lesson's room and closes the stack", () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);

    // The row names the room, and hands the map the index's own code for it:
    // the timetable prints "Q01 (Poříčí)", the index knows that room as
    // BA39N1009. Resolving first is what stops an unmatched string becoming a
    // control that looks fine and silently does nothing.
    fireEvent.click(screen.getByLabelText('Ukázat Q01 na mapě'));

    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusRoomByCode).toHaveBeenCalledWith('BA39N1009');
  });

  it('does not show the room row when no room can be resolved', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success' } } as never);
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/na mapě/)).not.toBeInTheDocument();
  });

  it('shows the personName from the search result immediately, before the profile fetch resolves (no raw-id flash)', () => {
    useAppStore.setState({
      personProfiles: {},
      personProfilesLoading: { 42: true },
      // fetchPersonProfileById is real store plumbing unrelated to this
      // fixture's point (the immediate personName title); stub it so the
      // hook's mount effect can't mutate personProfilesLoading mid-test.
      fetchPersonProfileById: vi.fn(),
    } as never);
    render(
      <PersonSheet
        sheet={{ kind: 'person', personId: '42', personName: 'Jan Novák' }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    // Never the raw id as a title.
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('shows a loading state (not the raw id) while the profile fetches and no personName was supplied', () => {
    useAppStore.setState({
      personProfiles: {},
      personProfilesLoading: { 42: true },
      fetchPersonProfileById: vi.fn(),
    } as never);
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    // Both the sheet title and the body placeholder read the loading label.
    expect(screen.getAllByText('Načítání…').length).toBeGreaterThan(0);
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('shows an error state (not the raw id) when the profile fetch fails and no personName was supplied', () => {
    useAppStore.setState({
      personProfiles: {
        42: { data: null, error: 'network error', fetchedAt: Date.now(), lang: 'cz' },
      },
      personProfilesLoading: {},
      // The hook retries a cached error on every mount (existing.error
      // skips the TTL short-circuit); stub the retry so the test can
      // observe the settled error state instead of the transient
      // re-fetch it would otherwise immediately kick off.
      fetchPersonProfileById: vi.fn(),
    } as never);
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.getByText('network error')).toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });
});

describe('PersonSheet — a staff profile', () => {
  const setMobileTab = vi.fn();
  const focusRoomByCode = vi.fn();

  beforeEach(() => {
    setMobileTab.mockClear();
    focusRoomByCode.mockClear();
    useAppStore.setState({
      language: 'cz',
      schedule: { data: [taughtLesson], status: 'success' },
      personProfiles: {
        42: {
          data: {
            personId: 42,
            name: 'Ing. David Procházka, Ph.D.',
            universityEmail: 'david.prochazka@mendelu.cz',
            privateEmail: null,
            programmeCode: null,
            programmeName: null,
            studyTypeSentence: null,
            yearSemesterSentence: null,
            roles: ['Akademický pracovník - odborný asistent - Ústav informatiky (PEF)'],
            officeCode: 'BA39N2056',
            officeName: 'Q2.56',
            phone: '+420 500 000 000',
            workplace: 'ÚI PEF, Zemědělská 1, 61300 Brno',
            consultationHours: null,
          },
          fetchedAt: Date.now(),
          lang: 'cz',
        },
      },
      personProfilesLoading: {},
      setMobileTab,
      focusRoomByCode,
    } as never);
  });

  it('leads with what they do, not with a study programme they do not have', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(
      screen.getByText('Akademický pracovník - odborný asistent - Ústav informatiky (PEF)')
    ).toBeInTheDocument();
  });

  it('never offers to phone them, even though IS publishes a work number', () => {
    // Students do not cold-call their lecturers, and IS's number reaches a
    // department line as often as a desk. The number is noise on a phone-sized
    // sheet, so it is not shown at all.
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.queryByText(/500 000 000/)).not.toBeInTheDocument();
    expect(screen.queryByText('Zavolat')).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('shows the OFFICE, not a room they happen to teach in', () => {
    // A lesson's room is where this person is for ninety minutes a week. The
    // office is where a student goes looking for them, so it wins whenever IS
    // publishes one — even though the schedule also offers Q01 here.
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.getByText('Q2.56')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Ukázat Q2.56 na mapě'));
    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusRoomByCode).toHaveBeenCalledWith('BA39N2056');
  });
});

describe('PersonSheet — a student profile', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      schedule: { data: [], status: 'success' },
      personProfiles: {
        77: {
          data: {
            personId: 77,
            name: 'Dominik Holek',
            universityEmail: 'xholek1@mendelu.cz',
            privateEmail: null,
            programmeCode: 'B1802A140006',
            programmeName: 'Otevřená informatika',
            studyTypeSentence: 'Bakalářský typ studia, prezenční forma',
            yearSemesterSentence: '1. ročník / 2. semestr studia',
            roles: [],
            officeCode: null,
            officeName: null,
            phone: null,
            workplace: null,
            consultationHours: null,
          },
          fetchedAt: Date.now(),
          lang: 'cz',
        },
      },
      personProfilesLoading: {},
      setMobileTab: vi.fn(),
      focusRoomByCode: vi.fn(),
    } as never);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows what a classmate is studying: the programme, the type and the year', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '77' }} onClose={vi.fn()} />);

    expect(screen.getByText('Dominik Holek')).toBeInTheDocument();
    expect(screen.getByText('xholek1@mendelu.cz')).toBeInTheDocument();
    expect(screen.getByText('Otevřená informatika')).toBeInTheDocument();
    expect(screen.getByText('Bakalářský typ studia, prezenční forma')).toBeInTheDocument();
    expect(screen.getByText('1. ročník / 2. semestr studia')).toBeInTheDocument();
  });

  it('offers Teams for a classmate too — they are in the same tenant', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '77' }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Napsat na Teams'));
    expect(openTeamsChat).toHaveBeenCalledWith('xholek1@mendelu.cz');
  });

  it('shows no room for someone who has no office', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '77' }} onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/na mapě/)).not.toBeInTheDocument();
  });
});
