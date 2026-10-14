import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OldIsPanel } from '../index';
import { useAppStore } from '../../../store/useAppStore';
import { pagesData } from '../../../data/pages';

/**
 * The old IS as a view of its own, reached from the sidebar. It replaces the
 * full-screen modal behind the flyout's dim "Starý IS" row: every page is a
 * real link (middle-click, hover URL) and no category hides behind "show more".
 */
describe('OldIsPanel', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', studiumId: '4321', facultyId: '2' } as never);
  });

  it('lists every page of every category without a "show more" fold', () => {
    render(<OldIsPanel />);
    const total = pagesData.reduce((n, c) => n + c.children.length, 0);
    expect(screen.getAllByRole('link')).toHaveLength(total);
    expect(screen.queryByText(/Zobrazit dalších/)).not.toBeInTheDocument();
  });

  it('opens pages in a new tab with studium and faculty filled in', () => {
    render(<OldIsPanel />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link.getAttribute('href')).not.toContain('{{');
    }
  });

  it('filters accent-insensitively', () => {
    render(<OldIsPanel />);
    fireEvent.change(screen.getByPlaceholderText('Filtrovat...'), {
      target: { value: 'zkousky' },
    });
    expect(screen.getByText(/Přihlašování na zkoušky/)).toBeInTheDocument();
    expect(screen.queryByText(/E-index/)).not.toBeInTheDocument();
  });

  it('says nothing was found for a query that matches nothing', () => {
    render(<OldIsPanel />);
    fireEvent.change(screen.getByPlaceholderText('Filtrovat...'), {
      target: { value: 'xyzzyq' },
    });
    expect(screen.getByText('Nic nenalezeno')).toBeInTheDocument();
  });
});
