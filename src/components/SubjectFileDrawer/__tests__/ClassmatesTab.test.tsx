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

vi.mock('../../../hooks/data/useClassmates', () => ({
  useClassmates: () => ({ classmates, isLoading: false, error: null }),
}));

describe('ClassmatesTab', () => {
  beforeEach(() => {
    useAppStore.setState({ studiumId: '1', obdobiId: '2' } as never);
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
