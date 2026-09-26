import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { overlayWrite } from '../../../store/overlay/overlayGuard';
import { ImpersonationBanner } from '../ImpersonationBanner';

const active = {
  selection: {
    programId: '1889',
    shortCode: 'B-F',
    name: 'Finance',
    faculty: 'PEF',
    year: 1,
    group: 2,
    periodLabel: 'ZS 2026/2027',
    rozvrh: {} as never,
  },
  result: {
    plan: {} as never,
    schedule: [],
    subjects: { version: 1, lastUpdated: '', data: {} },
    fetchedAt: 0,
  },
};

beforeEach(() =>
  useAppStore.setState(overlayWrite({ impersonation: null, language: 'cz' as const }))
);

describe('ImpersonationBanner', () => {
  it('renders nothing when not impersonating', () => {
    const { container } = render(<ImpersonationBanner variant="floating" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('floats at the bottom on desktop, clear of the top-centre toasts', () => {
    // SuggestionsToast and the Toaster both sit top-centre for a reis_admin.
    useAppStore.setState(overlayWrite({ impersonation: active }));
    render(<ImpersonationBanner variant="floating" />);
    expect(screen.getByRole('status').className).toMatch(/\bbottom-4\b/);
    expect(screen.getByRole('status').className).not.toMatch(/\btop-/);
  });
  it('names programme, year and group, and exits on click', () => {
    const stop = vi.fn(async () => {});
    useAppStore.setState(overlayWrite({ impersonation: active, stopImpersonation: stop }));
    render(<ImpersonationBanner variant="row" />);
    expect(screen.getByText(/B-F · 1\. ročník/)).toBeInTheDocument();
    expect(screen.getByText(/2\. skupina/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ukončit' }));
    expect(stop).toHaveBeenCalledOnce();
  });
});
