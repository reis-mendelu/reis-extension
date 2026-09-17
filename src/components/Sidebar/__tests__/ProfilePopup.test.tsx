import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProfilePopup } from '../ProfilePopup';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(undefined),
    // Resolves: the slice chains `.catch` on this, as the real service allows.
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));
vi.mock('../../../hooks/useSpolkySettings', () => ({
  useSpolkySettings: () => ({ isSubscribed: () => false, toggleAssociation: vi.fn() }),
}));

beforeEach(() => {
  useAppStore.setState({ language: 'en', isEduroamOpen: false, eduroamInitialTarget: null });
});
afterEach(cleanup);

describe('ProfilePopup — eduroam', () => {
  it('is where eduroam lives now, and opening it closes the popup', () => {
    const onClose = vi.fn();
    render(<ProfilePopup isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /eduroam/i }));
    expect(useAppStore.getState().isEduroamOpen).toBe(true);
    expect(useAppStore.getState().eduroamInitialTarget).toMatch(/^(mac|windows)$/);
    expect(onClose).toHaveBeenCalled();
  });
});
