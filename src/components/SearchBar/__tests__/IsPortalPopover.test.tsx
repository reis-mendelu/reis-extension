import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IsPortalPopover } from '../IsPortalPopover';
import { IsSearchTriggers } from '../IsSearchTriggers';
import { useAppStore } from '../../../store/useAppStore';

/**
 * The extension's IS page directory. Its filter moved to
 * `data/pages/filterPages.ts` so the phone's "Starý IS" segment shares it; this
 * pins that the desktop still filters exactly as it did.
 */
describe('IsPortalPopover', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', studiumId: '4321' } as never);
  });

  it('filters accent-insensitively and shows every match', () => {
    render(<IsPortalPopover isOpen onClose={() => {}} />);
    expect(screen.getByText(/E-index/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Filtrovat...'), {
      target: { value: 'zkousky' },
    });
    expect(screen.getByText(/Přihlašování na zkoušky/)).toBeInTheDocument();
    expect(screen.queryByText(/E-index/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Zobrazit dalších/)).not.toBeInTheDocument();
  });

  it('keeps a whole category when its name matches', () => {
    render(<IsPortalPopover isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filtrovat...'), {
      target: { value: 'portal verejnych' },
    });
    expect(screen.getByText('Portál veřejných informací')).toBeInTheDocument();
    expect(screen.getByText(/Katalog předmětů/)).toBeInTheDocument();
    expect(screen.getByText(/Rozvrhy/)).toBeInTheDocument();
  });

  it('says nothing was found for a query that matches nothing', () => {
    render(<IsPortalPopover isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Filtrovat...'), {
      target: { value: 'xyzzyq' },
    });
    expect(screen.getByText('Nic nenalezeno')).toBeInTheDocument();
  });
});

describe('IS flyout trigger', () => {
  it('is labelled "Starý IS", matching the phone segment', () => {
    useAppStore.setState({ language: 'cz' } as never);
    const { unmount } = render(<IsSearchTriggers onOpen={() => {}} buttonClassName="" />);
    expect(screen.getByRole('button', { name: 'Starý IS' })).toBeInTheDocument();
    unmount();

    useAppStore.setState({ language: 'en' } as never);
    render(<IsSearchTriggers onOpen={() => {}} buttonClassName="" />);
    expect(screen.getByRole('button', { name: 'Old IS' })).toBeInTheDocument();
  });
});
