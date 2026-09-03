import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from '../BottomNav';
import { useAppStore } from '../../../../store/useAppStore';

describe('BottomNav', () => {
  beforeEach(() => {
    useAppStore.setState({ mobileTab: 'calendar', language: 'cz', keyboardOpen: false });
  });

  // Five again, but the fifth is the PROFILE, not "Student": that slot was a
  // search field, search became a header action, and the freed slot went to the
  // profile — which had been a sheet behind the header avatar. See
  // ProfileScreen.test.tsx and persistentHeader.test.tsx.
  it('renders five nav buttons', () => {
    render(<BottomNav />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('labels only the active tab', () => {
    render(<BottomNav />);
    expect(screen.getByText('Kalendář')).toBeInTheDocument();
    expect(screen.queryByText('Zkoušky')).not.toBeInTheDocument();
  });

  it('marks the active tab with aria-current', () => {
    render(<BottomNav />);
    const current = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Kalendář');
  });

  it('marks the store-seeded tab as current on first render, not the first tab in the list', () => {
    useAppStore.setState({ mobileTab: 'subjects' });
    render(<BottomNav />);

    const subjectsButton = screen.getByRole('button', { name: 'Předměty' });
    expect(subjectsButton).toHaveAttribute('aria-current', 'page');
    expect(subjectsButton).toHaveTextContent('Předměty');

    const calendarButton = screen.getByRole('button', { name: 'Kalendář' });
    expect(calendarButton).not.toHaveAttribute('aria-current');
    expect(calendarButton).not.toHaveTextContent('Kalendář');
  });

  it('switches the tab on click and re-renders the DOM to match', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Zkoušky' }));

    expect(useAppStore.getState().mobileTab).toBe('exams');

    const examsButton = screen.getByRole('button', { name: 'Zkoušky' });
    expect(examsButton).toHaveAttribute('aria-current', 'page');
    expect(examsButton).toHaveTextContent('Zkoušky');

    const calendarButton = screen.getByRole('button', { name: 'Kalendář' });
    expect(calendarButton).not.toHaveAttribute('aria-current');
    expect(calendarButton).not.toHaveTextContent('Kalendář');
  });

  it('renders nothing while the soft keyboard is open', () => {
    useAppStore.setState({ keyboardOpen: true });
    const { container } = render(<BottomNav />);
    expect(container).toBeEmptyDOMElement();
  });
});
