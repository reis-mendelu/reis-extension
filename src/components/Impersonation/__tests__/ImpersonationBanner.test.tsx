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
    resolved: { programId: '1889', shortCode: 'B-F', rozvrh: {} as never },
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
  it('names a persona the way the list does, and exits with Já', () => {
    const stop = vi.fn(async () => {});
    const persona = { ...active, selection: { ...active.selection, personaId: 'finance' } };
    useAppStore.setState(overlayWrite({ impersonation: persona, stopImpersonation: stop }));
    render(<ImpersonationBanner variant="row" />);
    expect(screen.getByRole('status').textContent).toContain('Finance · B-F');
    fireEvent.click(screen.getByRole('button', { name: 'Já' }));
    expect(stop).toHaveBeenCalledOnce();
  });

  it('names the persona by its own code, as the list does, when IS resolved a variant', () => {
    const zf = {
      ...active,
      selection: { ...active.selection, shortCode: 'B-RSZ', personaId: 'zf' },
    };
    useAppStore.setState(overlayWrite({ impersonation: zf }));
    render(<ImpersonationBanner variant="row" />);
    expect(screen.getByRole('status').textContent).toContain('Správa zeleně · B-RASZ');
  });

  it('names Erasmus by its faculty, in the English it switched to', () => {
    const erasmus = {
      ...active,
      selection: { ...active.selection, shortCode: 'Z-EXC', personaId: 'erasmus', erasmus: true },
    };
    useAppStore.setState(overlayWrite({ impersonation: erasmus, language: 'en' as const }));
    render(<ImpersonationBanner variant="row" />);
    const text = screen.getByRole('status').textContent;
    expect(text).toContain('Erasmus · PEF');
    expect(text).not.toContain('null');
  });
});
