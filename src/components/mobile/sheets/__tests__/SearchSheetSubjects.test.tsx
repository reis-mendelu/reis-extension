import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchSheet } from '../SearchSheet';
import { useAppStore } from '../../../../store/useAppStore';

// The Student tab could search IS's pages and IS's people, but not its
// subjects — so "what is this subject like before I register for it" had no
// answer on a phone or an iPad. `useSearch` was already returning a `subjects`
// section on every query; this screen read only `people` and dropped it.
describe('SearchSheet — searching the subject catalogue', () => {
  // The API shape `executeSearch` answers with — useSearch maps this into a
  // SearchResult itself (id `subject-<id>`, title from `name`).
  const subject = {
    id: '4242',
    name: 'Matematika I',
    code: 'MT1',
    faculty: 'PEF',
    semester: 'ZS',
    link: 'https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=4242',
  };

  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      recentSearches: [],
      recentPeople: [],
      subjects: null,
      studyPlanDual: null,
      studiumId: null,
      userFaculty: null,
      userSemester: null,
      isNarrow: true,
      executeSearch: vi
        .fn()
        .mockResolvedValue({ people: [], subjects: [subject], subjectsTruncated: false }),
    });
  });

  const searchSubjects = async (query: string) => {
    render(<SearchSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Předměty' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: query } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
  };

  it('lists subjects the catalogue search came back with', async () => {
    vi.useFakeTimers();
    try {
      await searchSubjects('Matem');
      expect(screen.getByText('Matematika I')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // A subject result is only useful if it opens the drawer the app already has
  // for one — syllabus, difficulty, files.
  it('opens the subject drawer for a tapped result', async () => {
    vi.useFakeTimers();
    try {
      await searchSubjects('Matem');
      fireEvent.mouseDown(screen.getByText('Matematika I'));

      expect(useAppStore.getState().mobileSheets).toContainEqual(
        expect.objectContaining({
          kind: 'subjectDrawer',
          courseCode: 'MT1',
          courseName: 'Matematika I',
          courseId: '4242',
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // Same discipline the Lidé tab needed: useSearch debounces and then goes to
  // the network, so an empty list mid-flight is not an answer.
  // Reported from the iPad: the desktop search can widen past the student's own
  // faculty, and the app could not — so a subject from another faculty was
  // unfindable on a phone no matter what you typed. `useSearch` has always
  // exposed the scope and the widen/narrow actions; only the desktop and the
  // old MobileSearchOverlay rendered them.
  it("offers to widen the search past the student's own faculty", async () => {
    vi.useFakeTimers();
    try {
      useAppStore.setState({ userFaculty: 'PEF' });
      await searchSubjects('Matem');

      expect(screen.getByText('Hledám v rámci tvé fakulty')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Celá univerzita/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Keyboard activation of a button dispatches click, never mousedown. With the
  // action on mousedown, Enter and Space did nothing — on the very device (an
  // iPad with a keyboard) this control was added for.
  it('changes scope from the keyboard, not only from a tap', async () => {
    vi.useFakeTimers();
    try {
      useAppStore.setState({ userFaculty: 'PEF' });
      await searchSubjects('Matem');
      fireEvent.click(screen.getByRole('button', { name: /Celá univerzita/ }));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.getByText('Hledám napříč univerzitou')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches to the whole university and offers the way back', async () => {
    vi.useFakeTimers();
    try {
      useAppStore.setState({ userFaculty: 'PEF' });
      await searchSubjects('Matem');
      fireEvent.click(screen.getByRole('button', { name: /Celá univerzita/ }));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.getByText('Hledám napříč univerzitou')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Jen moje fakulta/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Without a known faculty there is nothing to scope to, so the control would
  // be a switch between two identical searches.
  it('offers no scope control when the faculty is unknown', async () => {
    vi.useFakeTimers();
    try {
      useAppStore.setState({ userFaculty: null });
      await searchSubjects('Matem');

      expect(screen.queryByText('Hledám v rámci tvé fakulty')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not claim "nothing found" before the search has answered', () => {
    render(<SearchSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Předměty' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Matem' } });

    expect(screen.queryByText('Nic jsme nenašli. Zkus to jinak.')).not.toBeInTheDocument();
    expect(screen.getByText('Načítání výsledků...')).toBeInTheDocument();
  });
});
