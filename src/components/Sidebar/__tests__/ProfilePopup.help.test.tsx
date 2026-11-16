import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfilePopup } from '../ProfilePopup';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));

describe('ProfilePopup — Nápověda', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' }));

  it('links the guide index in the support block, above Nahlásit chybu', () => {
    render(<ProfilePopup isOpen />);
    const help = screen.getByRole('link', { name: 'Nápověda' });
    expect(help).toHaveAttribute('href', 'https://reisapp.cz/navody?z=app');
    expect(help).toHaveAttribute('target', '_blank');
    const report = screen.getByRole('button', { name: /Nahlásit chybu/ });
    expect(help.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the external-link icon, since it opens reisapp.cz in a new tab', () => {
    render(<ProfilePopup isOpen />);
    const help = screen.getByRole('link', { name: 'Nápověda' });
    expect(help.querySelector('svg.lucide-external-link')).not.toBeNull();
  });

  it('links the English index in English', () => {
    useAppStore.setState({ language: 'en' });
    render(<ProfilePopup isOpen />);
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute(
      'href',
      'https://reisapp.cz/en/guides?z=app'
    );
  });
});
