import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { useUserParams } from '../../../hooks/useUserParams';
import { ProfilePopup } from '../ProfilePopup';

vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: vi.fn() }));

describe('ProfilePopup suggestions badge', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en', adminRole: null, suggestionsUnread: 3 });
    vi.mocked(useUserParams).mockReturnValue({
      params: { studium: '149707', obdobi: '2025', studentId: '123456', fullName: 'Test Student' },
      loading: false,
    } as never);
  });

  it('hides the badge from a student session', () => {
    render(<ProfilePopup isOpen onClose={() => {}} />);
    expect(screen.queryByTestId('suggestions-badge')).not.toBeInTheDocument();
  });

  it('shows the unread count for a reis_admin session', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 3 });
    render(<ProfilePopup isOpen onClose={() => {}} />);
    expect(screen.getByTestId('suggestions-badge')).toHaveTextContent('3');
  });

  it('hides the badge when a reis_admin has nothing unread', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 0 });
    render(<ProfilePopup isOpen onClose={() => {}} />);
    expect(screen.queryByTestId('suggestions-badge')).not.toBeInTheDocument();
  });
});
