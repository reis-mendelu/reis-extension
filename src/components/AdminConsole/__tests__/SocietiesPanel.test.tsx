import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { SocietiesPanel } from '../SocietiesPanel';

const setSocietyActive = vi.fn(async () => true);

beforeEach(() => {
  setSocietyActive.mockClear();
  useAppStore.setState({ societies: BUNDLED_SOCIETIES, setSocietyActive } as never);
});

const rowOf = (name: string) =>
  screen
    .getByText(name, { selector: 'div.truncate' })
    .closest('div.flex.items-center') as HTMLElement;

describe('SocietiesPanel', () => {
  it('lists every society in the catalog', () => {
    render(<SocietiesPanel />);
    for (const s of Object.values(BUNDLED_SOCIETIES)) {
      // getAll: a society whose glyph equals its name (USAF) prints it twice.
      expect(screen.getAllByText(s.name).length).toBeGreaterThan(0);
    }
  });

  it('hides a society', () => {
    render(<SocietiesPanel />);
    fireEvent.click(within(rowOf('ZF Spolek')).getByRole('button', { name: /hide|skrýt/i }));
    expect(setSocietyActive).toHaveBeenCalledWith('zf', false);
  });

  it('offers to show a hidden society again, and says it is hidden', () => {
    useAppStore.setState({
      societies: { ...BUNDLED_SOCIETIES, zf: { ...BUNDLED_SOCIETIES.zf!, isActive: false } },
    });
    render(<SocietiesPanel />);
    const row = rowOf('ZF Spolek');
    expect(within(row).getByText(/hidden|skrytý/i)).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: /show|zobrazit/i }));
    expect(setSocietyActive).toHaveBeenCalledWith('zf', true);
  });

  it('opens the add form', () => {
    render(<SocietiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add society|přidat spolek/i }));
    expect(screen.getByRole('button', { name: /save|uložit/i })).toBeInTheDocument();
  });
});
