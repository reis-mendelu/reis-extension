import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HiddenLessonsRows } from '../HiddenLessonsRows';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * The phone's way back from a hide, in Nastavení — where the first-time hint
 * says it is ("Profil → Nastavení"), the same words as on the extension.
 */
describe('HiddenLessonsRows', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      hiddenItems: {
        courses: [{ courseCode: 'EBC-VF1', courseName: 'Veřejné finance 1', type: 'seminar' }],
        events: [{ id: 'L1', courseCode: 'EBC-EK', courseName: 'Ekonometrie 1', date: '20261029' }],
      },
    });
  });

  it('renders nothing while nothing is hidden', () => {
    useAppStore.setState({ hiddenItems: { courses: [], events: [] } });
    const { container } = render(<HiddenLessonsRows />);
    expect(container.textContent).toBe('');
  });

  it('lists every hide with what it covers', () => {
    render(<HiddenLessonsRows />);
    expect(screen.getByText('Skryté položky')).toBeTruthy();
    expect(screen.getByText('Veřejné finance 1')).toBeTruthy();
    expect(screen.getByText('Cvičení')).toBeTruthy();
    expect(screen.getByText('Ekonometrie 1')).toBeTruthy();
    expect(screen.getByText('Jedna událost · 29. 10.')).toBeTruthy();
  });

  it('restores a hidden seminar series and a hidden lesson', async () => {
    render(<HiddenLessonsRows />);
    const [first, second] = screen.getAllByRole('button', { name: /Obnovit/ });
    fireEvent.click(first!);
    fireEvent.click(second!);
    await waitFor(() =>
      expect(useAppStore.getState().hiddenItems).toEqual({ courses: [], events: [] })
    );
  });

  it('gives every restore a full touch target', () => {
    render(<HiddenLessonsRows />);
    for (const b of screen.getAllByRole('button', { name: /Obnovit/ })) {
      expect(b.className).toContain('min-h-11');
    }
  });
});
