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
      expect.objectContaining({
        id: 'kino',
        name: 'Kino',
        shortName: 'KINO',
        color: '#123456',
        kind: 'society',
        audience: null,
      }),
      logoFile,
      true,
      { light: null, dark: null }
    );
    await waitFor(() => expect(createSocietyAccount).toHaveBeenCalledWith('kino', 'Kino'));
    expect(await screen.findByText('generated-pw-123')).toBeInTheDocument();
    // The accounts panel below must list the new login, or it keeps offering to create it.
    expect(loadSocietyAccounts).toHaveBeenCalled();
  });
});

describe('SocietyForm (failures)', () => {
  const fillNew = (id: string) => {
    fill(/login name|přihlašovací jméno/i, id);
    fill(/^name$|^název$/i, 'Nový');
    fill(/short name|zkratka/i, 'NEW');
    fill(/pin colou?r|barva/i, '#123456');
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
});

describe('SocietyForm (edit)', () => {
  it('locks the id and saves without requiring a new logo', async () => {
    render(<SocietyForm society={BUNDLED_SOCIETIES.zf} onDone={() => {}} />);
    expect(screen.getByLabelText(/login name|přihlašovací jméno/i)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() =>
      expect(saveSociety).toHaveBeenCalledWith(expect.objectContaining({ id: 'zf' }), null, false, {
        light: null,
        dark: null,
      })
    );
    expect(createSocietyAccount).not.toHaveBeenCalled();
  });

  // Follow is gone (spec 2026-10-08), but builds 5.1.1–5.3.0 still seed follows
  // from auto_follow_faculty: an edit must not quietly clear it.
  it('keeps the stored auto-follow flag, which old builds still read', async () => {
    render(<SocietyForm society={BUNDLED_SOCIETIES.zf} onDone={() => {}} />);
    expect(screen.queryByLabelText(/automati/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(1));
    expect(saveSociety.mock.calls[0]![0]).toMatchObject({ id: 'zf', autoFollowFaculty: true });
  });
});

// Only what the admin changed is written. The form's copy of a society can be
// stale (another admin edited it since the catalog loaded), and the holder a
// new default is released from is not even on screen: sending their instagram
// back wrote an old handle over a fresh one, or nulled it.
describe('SocietyForm (instagram)', () => {
  const zfWithHandle = { ...BUNDLED_SOCIETIES.zf!, instagram: 'zfig' };
  beforeEach(() => {
    useAppStore.setState({ societies: { ...BUNDLED_SOCIETIES, zf: zfWithHandle } });
  });
  const save = () => fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
  const lastInput = () => saveSociety.mock.calls.at(-1)![0];

  it('leaves the handle out of an edit that did not touch it', async () => {
    render(<SocietyForm society={zfWithHandle} onDone={() => {}} />);
    fill(/^name$|^název$/i, 'ZF Jinak');
    save();
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(1));
    expect(lastInput()).toMatchObject({ id: 'zf', name: 'ZF Jinak' });
    expect(lastInput()).not.toHaveProperty('instagram');
  });

  it('sends a changed handle', async () => {
    render(<SocietyForm society={zfWithHandle} onDone={() => {}} />);
    fill(/^instagram/i, '@novy.ig');
    save();
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(1));
    expect(lastInput()).toMatchObject({ id: 'zf', instagram: 'novy.ig' });
  });

  it('sends null for a cleared handle', async () => {
    render(<SocietyForm society={zfWithHandle} onDone={() => {}} />);
    fill(/^instagram/i, '');
    save();
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(1));
    expect(lastInput()).toMatchObject({ id: 'zf', instagram: null });
  });
});

describe('SocietyForm (auto-follow on a faculty move)', () => {
  it('drops the flag when the faculty changes, so it never collides with another holder', async () => {
    render(<SocietyForm society={BUNDLED_SOCIETIES.zf} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/faculty|fakulta/i), { target: { value: 'af' } });
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(1));
    expect(saveSociety.mock.calls[0]![0]).toMatchObject({ id: 'zf', autoFollowFaculty: false });
  });
});
