import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassmatesTab } from '../ClassmatesTab';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../ui/PersonPhoto', () => ({
  PersonPhoto: ({ alt }: { alt: string }) => <span data-testid="photo" aria-label={alt} />,
}));

vi.mock('../../Classmates/ClassmatePersonDrawer', () => ({
  ClassmatePersonDrawer: () => null,
}));

const person = (i: number) => ({
  personId: 900000 + i,
  photoUrl: '',
  name: `Student ${String(i).padStart(3, '0')}`,
  studyInfo: 'PEF B-EM prez [sem 1, roč 1]',
});
const SEMINAR = [person(0), person(1)];
const LECTURE = Array.from({ length: 519 }, (_, i) => person(i));

const seminar = vi.hoisted(() => ({
  result: { classmates: [] as unknown[], isLoading: false, error: null, noSeminar: false },
}));
vi.mock('../../../hooks/data/useClassmates', () => ({
  useClassmates: () => seminar.result,
}));

const subject = vi.hoisted(() => ({
  active: [] as boolean[],
  result: {
    classmates: null as unknown[] | null,
    isLoading: false,
    error: undefined as string | undefined,
  },
}));
vi.mock('../../../hooks/data/useSubjectClassmates', () => ({
  useSubjectClassmates: (_code: string, active: boolean) => {
    subject.active.push(active);
    return subject.result;
  },
}));

const tab = (name: string) => screen.getByRole('tab', { name });

describe('ClassmatesTab — Cvičení / Celý předmět', () => {
  beforeEach(() => {
    useAppStore.setState({ studiumId: '1', obdobiId: '2', language: 'cz' } as never);
    seminar.result = { classmates: SEMINAR, isLoading: false, error: null, noSeminar: false };
    subject.active = [];
    subject.result = { classmates: LECTURE, isLoading: false, error: undefined };
  });

  it('opens on the seminar group and leaves the whole subject unfetched', () => {
    render(<ClassmatesTab courseCode="EBC-IV" />);
    expect(tab('Cvičení')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Celý předmět')).toHaveAttribute('aria-selected', 'false');
    expect(subject.active.every((a) => a === false)).toBe(true);
    expect(screen.getByText(/Spolužáci z tvého cvičení/)).toHaveTextContent('· 2');
  });

  it('asks for the whole subject only when the student switches to it', () => {
    render(<ClassmatesTab courseCode="EBC-IV" />);
    fireEvent.click(tab('Celý předmět'));
    expect(subject.active.at(-1)).toBe(true);
    expect(tab('Celý předmět')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Všichni, kdo předmět studují/)).toHaveTextContent('· 519');
  });

  it('opens a subject without cvičení on the whole subject', () => {
    seminar.result = { classmates: [], isLoading: false, error: null, noSeminar: true };
    render(<ClassmatesTab courseCode="EBC-MNG" />);
    expect(tab('Celý předmět')).toHaveAttribute('aria-selected', 'true');
    expect(subject.active.at(-1)).toBe(true);
    expect(screen.queryByText('Tento předmět nemá cvičení')).not.toBeInTheDocument();
  });

  it('from the no-cvičení state, offers the whole subject in one tap', () => {
    seminar.result = { classmates: [], isLoading: false, error: null, noSeminar: true };
    render(<ClassmatesTab courseCode="EBC-MNG" />);
    fireEvent.click(tab('Cvičení'));
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit celý předmět' }));
    expect(tab('Celý předmět')).toHaveAttribute('aria-selected', 'true');
  });

  it('says what it is loading — hundreds of students take a few seconds', () => {
    subject.result = { classmates: null, isLoading: true, error: undefined };
    render(<ClassmatesTab courseCode="EBC-IV" />);
    fireEvent.click(tab('Celý předmět'));
    expect(screen.getByText('Načítám všechny, kdo předmět studují…')).toBeInTheDocument();
  });

  it('offers a retry when the whole subject could not be read', () => {
    const refresh = vi.fn();
    useAppStore.setState({ refreshSubjectClassmates: refresh } as never);
    subject.result = { classmates: null, isLoading: false, error: 'IS 500' };
    render(<ClassmatesTab courseCode="EBC-IV" />);
    fireEvent.click(tab('Celý předmět'));
    expect(screen.getByText('Nepodařilo se načíst spolužáky')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(refresh).toHaveBeenCalledWith('EBC-IV');
  });

  /**
   * The whole subject is one scrollable list. The listing is already in memory
   * (every spoluzaci.pl page is read up front), so a "show 40 more" button only
   * made the student tap for rows the app already had. Photos are what cost a
   * request each, and ClassmatesList defers those until a row is on screen
   * (ClassmatesList.photos.test.tsx; this file mocks PersonPhoto away).
   */
  it('renders every student of a 519-student lecture, with no "show more" step', () => {
    render(<ClassmatesTab courseCode="EBC-IV" />);
    fireEvent.click(tab('Celý předmět'));
    expect(screen.getAllByText(/^Student \d{3}$/)).toHaveLength(519);
    expect(screen.getByText('Student 518')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zobrazit dalších/ })).not.toBeInTheDocument();
  });

  it('searches the whole list, not only the rows on screen', () => {
    render(<ClassmatesTab courseCode="EBC-IV" />);
    fireEvent.click(tab('Celý předmět'));
    fireEvent.change(screen.getByPlaceholderText('Vyhledat...'), {
      target: { value: 'Student 500' },
    });
    expect(screen.getByText('Student 500')).toBeInTheDocument();
    expect(screen.getAllByTestId('photo')).toHaveLength(1);
  });

  /**
   * The search stays on screen over the whole list now, so a student can type
   * from deep in it. Without a reset the scroller keeps its old offset and the
   * first matches sit above the view. Every scrolled ancestor is reset because
   * the element that scrolls differs per tree (the drawer body on the
   * extension, the tab's own box on the phone).
   */
  it('jumps back to the first match when the search changes', () => {
    // The outer box stands in for the extension drawer's body, which is what
    // actually scrolls there; the tab's own box is the phone's scroller.
    render(
      <div data-testid="drawer-body">
        <ClassmatesTab courseCode="EBC-IV" />
      </div>
    );
    fireEvent.click(tab('Celý předmět'));
    const scrolledTo = (el: HTMLElement, initial: number) => {
      const box = { top: initial };
      Object.defineProperty(el, 'scrollTop', {
        configurable: true,
        get: () => box.top,
        set: (v: number) => (box.top = v),
      });
      return box;
    };
    const tabBox = scrolledTo(
      screen.getByText('Student 000').closest('.overflow-y-auto') as HTMLElement,
      3000
    );
    const drawerBody = scrolledTo(screen.getByTestId('drawer-body'), 48000);
    fireEvent.change(screen.getByPlaceholderText('Vyhledat...'), {
      target: { value: 'Student 5' },
    });
    expect(tabBox.top).toBe(0);
    expect(drawerBody.top).toBe(0);
  });
});
