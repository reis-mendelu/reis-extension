import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

vi.mock('../../../api/societyAccounts', () => ({
  createSocietyAccount: vi.fn(async () => ({ password: 'generated-pw-123' })),
}));
import { createSocietyAccount } from '../../../api/societyAccounts';
import { SocietyForm } from '../SocietyForm';

const saveSociety = vi.fn(async () => ({}));

beforeEach(() => {
  saveSociety.mockClear();
  vi.mocked(createSocietyAccount).mockClear();
  useAppStore.setState({ societies: BUNDLED_SOCIETIES, saveSociety } as never);
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
