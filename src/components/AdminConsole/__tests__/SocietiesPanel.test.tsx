import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { SocietiesPanel } from '../SocietiesPanel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

const setSocietyActive = vi.fn(async (_id: string, _active: boolean) => true);

beforeEach(() => {
  setSocietyActive.mockClear();
  vi.mocked(toast.error).mockClear();
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

  // setSocietyActive reports failure as false; dropping it left the admin
  // thinking a society was hidden while students still saw it.
  it('says so when hiding fails', async () => {
    setSocietyActive.mockResolvedValueOnce(false);
    render(<SocietiesPanel />);
    fireEvent.click(within(rowOf('ZF Spolek')).getByRole('button', { name: /hide|skrýt/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('says so when hiding throws', async () => {
    setSocietyActive.mockRejectedValueOnce(new Error('IndexedDB'));
    render(<SocietiesPanel />);
    fireEvent.click(within(rowOf('ZF Spolek')).getByRole('button', { name: /hide|skrýt/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('stays quiet when hiding works', async () => {
    render(<SocietiesPanel />);
    fireEvent.click(within(rowOf('ZF Spolek')).getByRole('button', { name: /hide|skrýt/i }));
    await waitFor(() => expect(setSocietyActive).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('opens the add form', () => {
    render(<SocietiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add society|přidat spolek/i }));
    expect(screen.getByRole('button', { name: /save|uložit/i })).toBeInTheDocument();
  });
});
