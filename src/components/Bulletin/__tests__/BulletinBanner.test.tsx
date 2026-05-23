import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulletinBanner } from '../BulletinBanner';
import { useAppStore } from '../../../store/useAppStore';
import { useIsMobile } from '../../ui/use-mobile';

// Mock useIsMobile hook
vi.mock('../../ui/use-mobile', () => ({
  useIsMobile: vi.fn(),
}));

describe('BulletinBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Configure app store state
    useAppStore.setState({
      language: 'en',
      bulletinPosts: [
        { title: 'Test Post 1', categories: ['Inzerce'], url: 'https://example.com/1' },
        { title: 'Test Post 2', categories: ['Ubytování', 'Ostatní'], url: 'https://example.com/2' }
      ],
      bulletinExpanded: false,
      bulletinLoading: false,
      bulletinError: false,
      bulletinHydrated: true,
      setBulletinExpanded: async (val) => {
        useAppStore.setState({ bulletinExpanded: val });
      },
      loadBulletinIfStale: async () => {},
    });
  });

  describe('Desktop View', () => {
    beforeEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(false);
    });

    it('should render collapsed button by default when inline is true', () => {
      render(<BulletinBanner inline />);
      
      const expandBtn = screen.getByLabelText('Expand bulletin board');
      expect(expandBtn).toBeInTheDocument();
      expect(screen.queryByText('Test Post 1')).not.toBeInTheDocument();
    });

    it('should render inline list when expanded is true', () => {
      useAppStore.setState({ bulletinExpanded: true });
      render(<BulletinBanner inline />);

      expect(screen.getByText('Test Post 1')).toBeInTheDocument();
      expect(screen.getByText('Test Post 2')).toBeInTheDocument();
    });

    it('should expand on collapsed button click', () => {
      render(<BulletinBanner inline />);
      
      const expandBtn = screen.getByLabelText('Expand bulletin board');
      fireEvent.click(expandBtn);

      expect(useAppStore.getState().bulletinExpanded).toBe(true);
    });

    it('should close dropdown on click outside', () => {
      useAppStore.setState({ bulletinExpanded: true });
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <BulletinBanner inline />
        </div>
      );

      expect(screen.getByText('Test Post 1')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId('outside'));

      expect(useAppStore.getState().bulletinExpanded).toBe(false);
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(true);
    });

    it('should render collapsed button by default and not render inline list even if expanded is true', () => {
      useAppStore.setState({ bulletinExpanded: true });
      render(<BulletinBanner inline />);

      // The header button should still be present
      expect(screen.getByLabelText('Expand bulletin board')).toBeInTheDocument();
      
      // Fullscreen overlay title is present
      expect(screen.getByRole('heading', { name: 'Bulletin Board' })).toBeInTheDocument();
      
      // Post items should be present inside the overlay
      expect(screen.getByText('Test Post 1')).toBeInTheDocument();
      expect(screen.getByText('Test Post 2')).toBeInTheDocument();
    });

    it('should close overlay on back button click', () => {
      useAppStore.setState({ bulletinExpanded: true });
      render(<BulletinBanner inline />);

      const backBtn = screen.getByLabelText('Collapse bulletin board');
      fireEvent.click(backBtn);

      expect(useAppStore.getState().bulletinExpanded).toBe(false);
    });

    it('should display loading skeleton on mobile when loading is true and no posts', () => {
      useAppStore.setState({
        bulletinExpanded: true,
        bulletinPosts: [],
        bulletinLoading: true,
      });
      render(<BulletinBanner inline />);

      expect(screen.getByTestId('bulletin-loading')).toBeInTheDocument();
    });

    it('should display error alert on mobile when error is true and no posts', () => {
      useAppStore.setState({
        bulletinExpanded: true,
        bulletinPosts: [],
        bulletinError: true,
      });
      render(<BulletinBanner inline />);

      expect(screen.getByTestId('bulletin-error')).toBeInTheDocument();
    });

    it('should display empty message on mobile when there are no posts', () => {
      useAppStore.setState({
        bulletinExpanded: true,
        bulletinPosts: [],
      });
      render(<BulletinBanner inline />);

      expect(screen.getByTestId('bulletin-empty')).toBeInTheDocument();
    });
  });
});
