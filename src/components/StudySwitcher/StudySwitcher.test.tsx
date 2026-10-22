import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudySwitcher } from './StudySwitcher';
import { useAppStore } from '../../store/useAppStore';

const A = { studium: '900001', label: 'PEF B-EKO komb [sem 1, roč 1]' };
const B = { studium: '900002', label: 'PEF B-OI prez [sem 3, roč 2]' };

describe('StudySwitcher', () => {
  const switchStudy = vi.fn(async () => {});
  beforeEach(() => {
    switchStudy.mockClear();
    useAppStore.setState({
      studies: [A, B],
      studiumId: A.studium,
      studySwitch: 'idle',
      switchStudy,
    });
  });

  // Almost every student: nothing to choose, nothing on screen.
  it('renders nothing for a student with one study', () => {
    useAppStore.setState({ studies: [A] });
    const { container } = render(<StudySwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists IS's own labels and marks the current study", () => {
    render(<StudySwitcher />);
    const current = screen.getByRole('button', { name: A.label });
    expect(current).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: B.label })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to the other study, and not to the current one', () => {
    render(<StudySwitcher />);
    fireEvent.click(screen.getByRole('button', { name: A.label }));
    expect(switchStudy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: B.label }));
    expect(switchStudy).toHaveBeenCalledWith(B.studium);
  });

  it('locks the choice while a switch runs, and says when one failed', () => {
    useAppStore.setState({ studySwitch: 'switching' });
    const { rerender } = render(<StudySwitcher />);
    expect(screen.getByRole('button', { name: B.label })).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();

    useAppStore.setState({ studySwitch: 'failed' });
    rerender(<StudySwitcher />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
