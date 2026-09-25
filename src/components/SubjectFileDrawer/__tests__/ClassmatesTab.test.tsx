import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassmatesTab } from '../ClassmatesTab';
import { useAppStore } from '../../../store/useAppStore';

// `alt` goes to an attribute, not to text: rendering the name twice would make
// every getByText below ambiguous.
vi.mock('../../ui/PersonPhoto', () => ({
  PersonPhoto: ({ alt }: { alt: string }) => <span data-testid="photo" aria-label={alt} />,
}));

// The desktop drawer is the thing the phone must NOT open — stub it so its
// presence is observable without pulling in AdaptiveDrawer's portal.
vi.mock('../../Classmates/ClassmatePersonDrawer', () => ({
  ClassmatePersonDrawer: ({ classmate }: { classmate: { name: string } | null }) =>
    classmate ? <div data-testid="desktop-drawer">{classmate.name}</div> : null,
}));

const classmates = [
  {
    personId: 111,
    photoUrl: '',
    name: 'Dofková Barbora',
    studyInfo: 'PEF B-OI-ZBOI prez [sem 2, roč 1]',
  },
];

const hook = vi.hoisted(() => ({
  result: { classmates: [] as unknown[], isLoading: false, error: null, noSeminar: false },
}));

vi.mock('../../../hooks/data/useClassmates', () => ({
  useClassmates: () => hook.result,
}));

describe('ClassmatesTab', () => {
  beforeEach(() => {
    useAppStore.setState({ studiumId: '1', obdobiId: '2', language: 'cz' } as never);
    hook.result = { classmates, isLoading: false, error: null, noSeminar: false };
  });

  /**
   * The roster is the seminar group only. Without saying so, a student reads
   * "24" as everyone taking the subject.
   */
  it('says the list is the seminar group, with its size', () => {
    render(<ClassmatesTab courseCode="EBC-IV" />);
    expect(screen.getByText(/Spolužáci z tvého cvičení/)).toHaveTextContent('· 1');
  });

  /**
   * A lecture-only subject (EBC-MNG in the real snapshot) has no seminar group,
   * so there is no roster to show — but "no classmates found" claims the
   * lecture is empty. Say why instead, and point at IS's full list.
   */
  it('explains a subject without cvičení instead of claiming nobody is enrolled', () => {
    hook.result = { classmates: [], isLoading: false, error: null, noSeminar: true };
    render(<ClassmatesTab courseCode="EBC-MNG" />);
    expect(screen.getByText('Tento předmět nemá cvičení')).toBeInTheDocument();
    expect(screen.queryByText('Žádní spolužáci nenalezeni')).not.toBeInTheDocument();
    expect(screen.queryByText(/Spolužáci z tvého cvičení/)).not.toBeInTheDocument();
  });

  it('still links IS for a subject without cvičení on the phone, which hides the end-of-list link', () => {
    hook.result = { classmates: [], isLoading: false, error: null, noSeminar: true };
    useAppStore.setState({
      subjects: { data: { 'EBC-MNG': { subjectId: '160001' } } },
    } as never);
    render(<ClassmatesTab courseCode="EBC-MNG" showIsBacklink={false} />);
    expect(screen.getByRole('link', { name: /IS MENDELU/ })).toHaveAttribute(
      'href',
      expect.stringContaining('spoluzaci.pl?predmet=160001;;studium=1;obdobi=2')
    );
  });

  it('keeps the generic empty state when a seminar group exists but lists nobody', () => {
    hook.result = { classmates: [], isLoading: false, error: null, noSeminar: false };
    render(<ClassmatesTab courseCode="EBC-IV" />);
    expect(screen.getByText('Žádní spolužáci nenalezeni')).toBeInTheDocument();
    expect(screen.queryByText('Tento předmět nemá cvičení')).not.toBeInTheDocument();
  });

  it('shows the study programme on desktop, where there is room for it', () => {
    render(<ClassmatesTab courseCode="EBC-IV" />);
    expect(screen.getByText(/PEF B-OI-ZBOI/)).toBeInTheDocument();
  });

  /**
   * On the phone that line only ever rendered as "PEF B-OI-ZBOI prez [se…" —
   * clipped mid-word — and it squeezed the name into wrapping onto two lines.
   * A truncated programme code tells a student nothing their classmate's name
   * doesn't; the name getting a full line does.
   */
  it('drops the study programme when asked, leaving the name a single line', () => {
    render(<ClassmatesTab courseCode="EBC-IV" showStudyInfo={false} />);
    expect(screen.queryByText(/PEF B-OI-ZBOI/)).not.toBeInTheDocument();
    expect(screen.getByText('Dofková Barbora').className).toContain('truncate');
  });

  it('opens the desktop drawer on click when no handler is given', () => {
    render(<ClassmatesTab courseCode="EBC-IV" />);
    fireEvent.click(screen.getByText('Dofková Barbora'));
    expect(screen.getByTestId('desktop-drawer')).toBeInTheDocument();
  });

  /**
   * The phone already has a person UI — the one search opens, with roles,
   * office and the map button. Tapping a classmate landed in a SECOND, weaker
   * person view instead. Handing the tap up lets the caller route it there.
   */
  it('hands the tap to the caller instead, and never opens the desktop drawer', () => {
    const onSelectPerson = vi.fn();
    render(<ClassmatesTab courseCode="EBC-IV" onSelectPerson={onSelectPerson} />);
    fireEvent.click(screen.getByText('Dofková Barbora'));
    expect(onSelectPerson).toHaveBeenCalledWith(expect.objectContaining({ personId: 111 }));
    expect(screen.queryByTestId('desktop-drawer')).not.toBeInTheDocument();
  });

  it('routes the keyboard activation the same way', () => {
    const onSelectPerson = vi.fn();
    render(<ClassmatesTab courseCode="EBC-IV" onSelectPerson={onSelectPerson} />);
    fireEvent.keyDown(screen.getByText('Dofková Barbora'), { key: 'Enter' });
    expect(onSelectPerson).toHaveBeenCalledTimes(1);
  });
});
