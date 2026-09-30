import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FollowChip } from '../FollowChip';
import { useAppStore } from '../../../store/useAppStore';

// A btn-ghost btn-xs chip next to the "Pořádá {shortName}" line — the same
// toggle Profile's follow list uses, reached one tap earlier from the event
// that made the student want it.
describe('FollowChip', () => {
  const toggleFollow = vi.fn();

  beforeEach(() => {
    toggleFollow.mockReset();
    useAppStore.setState({ language: 'cz', followed: [], toggleFollow } as never);
  });

  it('offers to follow when not yet followed', () => {
    render(<FollowChip societyId="esn" />);
    const btn = screen.getByRole('button', { name: 'Sledovat' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles follow on the given society id when tapped', () => {
    render(<FollowChip societyId="esn" />);
    fireEvent.click(screen.getByRole('button', { name: 'Sledovat' }));
    expect(toggleFollow).toHaveBeenCalledWith('esn');
  });

  it('shows the followed state with aria-pressed', () => {
    useAppStore.setState({ followed: ['esn'] } as never);
    render(<FollowChip societyId="esn" />);
    const btn = screen.getByRole('button', { name: 'Sleduješ ✓' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses the English labels in English', () => {
    useAppStore.setState({ language: 'en', followed: [] } as never);
    render(<FollowChip societyId="esn" />);
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
  });
});
