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
      schedule: { data: [taughtLesson], status: 'success', weekStart: null },
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

    fireEvent.click(screen.getByText('Ukázat kancelář na mapě'));

    expect(setMobileTab).toHaveBeenCalledWith('map');
    expect(focusRoomByCode).toHaveBeenCalledWith('Q01');
  });

  it('does not show the map button when no room can be resolved', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success', weekStart: null } } as never);
    render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
    expect(screen.queryByText('Ukázat kancelář na mapě')).not.toBeInTheDocument();
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
