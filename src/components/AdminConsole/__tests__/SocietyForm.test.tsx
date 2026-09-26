import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

vi.mock('../../../api/societyAccounts', () => ({
  createSocietyAccount: vi.fn(async () => ({ password: 'generated-pw-123' })),
}));
import { createSocietyAccount } from '../../../api/societyAccounts';
import { SocietyForm } from '../SocietyForm';

const saveSociety = vi.fn(async (..._args: unknown[]) => ({}));
const loadSocietyAccounts = vi.fn(async () => {});

beforeEach(() => {
  saveSociety.mockClear();
  loadSocietyAccounts.mockClear();
  vi.mocked(createSocietyAccount).mockClear();
  useAppStore.setState({ societies: BUNDLED_SOCIETIES, saveSociety, loadSocietyAccounts } as never);
});

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const logoFile = new File([new Uint8Array([1])], 'logo.png', { type: 'image/png' });

describe('SocietyForm (new)', () => {
  it('rejects an id that is not a valid login', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'Kino Klub');
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(saveSociety).not.toHaveBeenCalled();
  });

  it('rejects a taken id', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'esn');
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('rejects a colour that disappears on the light map', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'kino');
    fill(/^name$|^název$/i, 'Kino');
    fill(/short name|zkratka/i, 'KINO');
    fill(/pin colou?r|barva/i, '#ffe600');
    fireEvent.change(screen.getByLabelText(/^logo$/i), { target: { files: [logoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(saveSociety).not.toHaveBeenCalled();
  });

  it('saves the society, then creates its account and shows the password once', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'kino');
    fill(/^name$|^název$/i, 'Kino');
    fill(/short name|zkratka/i, 'KINO');
    fill(/pin colou?r|barva/i, '#123456');
    fireEvent.change(screen.getByLabelText(/^logo$/i), { target: { files: [logoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(1));
    expect(saveSociety).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kino', name: 'Kino', shortName: 'KINO', color: '#123456' }),
      logoFile,
      true
    );
    await waitFor(() => expect(createSocietyAccount).toHaveBeenCalledWith('kino', 'Kino'));
    expect(await screen.findByText('generated-pw-123')).toBeInTheDocument();
    // The accounts panel below must list the new login, or it keeps offering to create it.
    expect(loadSocietyAccounts).toHaveBeenCalled();
  });

  it('releases auto-follow from a HIDDEN holder too: the unique index ignores is_active', async () => {
    useAppStore.setState({
      societies: { ...BUNDLED_SOCIETIES, zf: { ...BUNDLED_SOCIETIES.zf!, isActive: false } },
    });
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'zfnew');
    fill(/^name$|^název$/i, 'ZF Nový');
    fill(/short name|zkratka/i, 'ZFN');
    fill(/pin colou?r|barva/i, '#123456');
    fireEvent.change(screen.getByLabelText(/faculty|fakulta/i), { target: { value: 'zf' } });
    fireEvent.click(screen.getByLabelText(/automati/i));
    fireEvent.change(screen.getByLabelText(/^logo$/i), { target: { files: [logoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(2));
    expect(saveSociety.mock.calls[0]![0]).toMatchObject({ id: 'zf', autoFollowFaculty: false });
    expect(saveSociety.mock.calls[1]![0]).toMatchObject({ id: 'zfnew', autoFollowFaculty: true });
  });
});

describe('SocietyForm (failures)', () => {
  const fillNew = (id: string, faculty?: string) => {
    fill(/login name|přihlašovací jméno/i, id);
    fill(/^name$|^název$/i, 'Nový');
    fill(/short name|zkratka/i, 'NEW');
    fill(/pin colou?r|barva/i, '#123456');
    if (faculty) {
      fireEvent.change(screen.getByLabelText(/faculty|fakulta/i), { target: { value: faculty } });
      fireEvent.click(screen.getByLabelText(/automati/i));
    }
    fireEvent.change(screen.getByLabelText(/^logo$/i), { target: { files: [logoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
  };

  it('re-enables Save and says so when a save step throws', async () => {
    saveSociety.mockRejectedValueOnce(new Error('createImageBitmap: unreadable'));
    render(<SocietyForm onDone={() => {}} />);
    fillNew('kino');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save|uložit/i })).toBeEnabled();
  });

  it('gives auto-follow back to the holder when the replacement fails to save', async () => {
    saveSociety
      .mockResolvedValueOnce({}) // holder released
      .mockResolvedValueOnce({ error: 'save_failed' }); // replacement fails
    render(<SocietyForm onDone={() => {}} />);
    fillNew('zfnew', 'zf');
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(3));
    expect(saveSociety.mock.calls[2]![0]).toMatchObject({ id: 'zf', autoFollowFaculty: true });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('SocietyForm (edit)', () => {
  it('locks the id and saves without requiring a new logo', async () => {
    render(<SocietyForm society={BUNDLED_SOCIETIES.zf} onDone={() => {}} />);
    expect(screen.getByLabelText(/login name|přihlašovací jméno/i)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() =>
      expect(saveSociety).toHaveBeenCalledWith(expect.objectContaining({ id: 'zf' }), null, false)
    );
    expect(createSocietyAccount).not.toHaveBeenCalled();
  });
});
