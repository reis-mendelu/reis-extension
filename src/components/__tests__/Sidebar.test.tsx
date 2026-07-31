import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import type { MenuItem } from '../menuConfig';

// Sidebar renders ProfilePopup, which calls useSpolkySettings — an async
// IndexedDB load ending in setIsLoading(false) inside a `finally`, with no
// mounted guard. Locally that tail lands before teardown; on CI's slower
// runner it lands after, and touching React state once happy-dom's window is
// gone throws "window is not defined" and fails the whole vitest run. These
// tests are about logo/nav routing, so the hook is stubbed rather than raced.
vi.mock('../../hooks/useSpolkySettings', () => ({
  useSpolkySettings: () => ({
    subscribedAssociations: [],
    toggleAssociation: vi.fn(),
    isSubscribed: () => false,
    isLoading: false,
  }),
}));

// WebISKAM's items: an 'iskam-dashboard' entry with no href — the click has
// to be handled by an explicit branch in Sidebar's onClick, same as
// IskamApp.tsx's real iskamItems.
const iskamItems: MenuItem[] = [{ id: 'iskam-dashboard', label: 'Přehled', icon: <span /> }];

describe('Sidebar (WebISKAM regression: logo + nav-item click on iskam-dashboard)', () => {
  it('clicking the logo while on iskam-dashboard stays on iskam-dashboard, not calendar', () => {
    const onViewChange = vi.fn();
    render(
      <Sidebar
        currentView="iskam-dashboard"
        onViewChange={onViewChange}
        items={iskamItems}
        isIskam
      />
    );
    // The logo button is the first rendered — it carries no text/aria-label.
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(onViewChange).toHaveBeenCalledWith('iskam-dashboard');
  });

  it('clicking the iskam-dashboard nav item calls onViewChange with iskam-dashboard', () => {
    const onViewChange = vi.fn();
    render(
      <Sidebar
        currentView="iskam-dashboard"
        onViewChange={onViewChange}
        items={iskamItems}
        isIskam
      />
    );
    fireEvent.click(screen.getByText('Přehled'));
    expect(onViewChange).toHaveBeenCalledWith('iskam-dashboard');
  });

  it('clicking the logo on the regular IS Mendelu sidebar (not iskam) goes to calendar', () => {
    const onViewChange = vi.fn();
    render(
      <Sidebar
        currentView="exams"
        onViewChange={onViewChange}
        items={[{ id: 'dashboard', label: 'Přehled', icon: <span /> }]}
      />
    );
    const logoButton = screen.getAllByRole('button')[0]!;
    fireEvent.click(logoButton);
    expect(onViewChange).toHaveBeenCalledWith('calendar');
  });
});
