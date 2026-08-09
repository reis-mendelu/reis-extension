import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonSheet } from '../PersonSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { BlockLesson } from '../../../../types/calendarTypes';

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

  it('shows a mailto link for the email', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.getByText('Napsat e-mail').closest('a')).toHaveAttribute(
      'href',
      'mailto:novak@mendelu.cz'
    );
  });

  it("deep-links to the map at their taught lesson's room and closes the stack", () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);

    // The button names the room, and hands the map the index's own code for
    // it: the timetable prints "Q01 (Poříčí)", the index knows that room as
    // BA39N1009. Resolving first is what stops an unmatched string becoming a
    // button that silently does nothing.
    fireEvent.click(screen.getByText('Ukázat Q01 na mapě'));

    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusRoomByCode).toHaveBeenCalledWith('BA39N1009');
  });

  it('does not show the map button when no room can be resolved', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success' } } as never);
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.queryByText(/na mapě/)).not.toBeInTheDocument();
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
      personProfiles: { 42: { data: null, error: 'network error', fetchedAt: Date.now() } },
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

  it('offers the work phone as a real call link', () => {
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.getByText('Zavolat').closest('a')).toHaveAttribute('href', 'tel:+420500000000');
  });

  it('navigates to the OFFICE, not to a room they happen to teach in', () => {
    // A lesson's room is where this person is for ninety minutes a week. The
    // office is where a student goes looking for them, so it wins whenever IS
    // publishes one — even though the schedule also offers Q01 here.
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Ukázat Q2.56 na mapě'));
    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusRoomByCode).toHaveBeenCalledWith('BA39N2056');
  });
});
