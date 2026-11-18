/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { StudyAidsPanel } from '../StudyAidsPanel';
import { useAppStore } from '../../../store/useAppStore';

const saveAdminStudyAids = vi.fn().mockResolvedValue(true);

beforeEach(() => {
  saveAdminStudyAids.mockClear();
  useAppStore.setState({
    language: 'cz',
    adminStudyAids: [
      { id: 'mendelu-app', audience: ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'], isActive: false },
    ],
    adminStudyAidsLoading: false,
    saveAdminStudyAids,
  } as any);
});

// "Studijní opory" in the console (reis_admin only, inside Otázky on both
// layouts): who is shown the mendelu.app link under Předměty. Not a partner:
// no logo, no society, only an audience and an on/off switch.
describe('StudyAidsPanel', () => {
  it('shows the link with its audience as faculty and programmes, and that it is off', () => {
    render(<StudyAidsPanel />);
    expect(screen.getByText('mendelu-app')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Zobrazovat studentům' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Agronomická fakulta/ })).toBeChecked();
    expect(
      screen.getByRole('textbox', { name: /Agronomická fakulta/ }) as HTMLInputElement
    ).toHaveValue('B-ATE, N-PTE, B-ZIN');
  });

  it('switches the link on for the listed programmes', async () => {
    render(<StudyAidsPanel />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Zobrazovat studentům' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() =>
      expect(saveAdminStudyAids).toHaveBeenCalledWith('mendelu-app', {
        audience: ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'],
        isActive: true,
      })
    );
  });

  it('saves a changed programme list, e.g. when a new programme is added', async () => {
    render(<StudyAidsPanel />);
    fireEvent.change(screen.getByRole('textbox', { name: /Agronomická fakulta/ }), {
      target: { value: 'b-ate, N-PTE, B-ZIN, N-TZO' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() =>
      expect(saveAdminStudyAids).toHaveBeenCalledWith('mendelu-app', {
        audience: ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN', 'af:N-TZO'],
        isActive: false,
      })
    );
  });

  it('does not save with no faculty picked, or a malformed programme code', () => {
    render(<StudyAidsPanel />);
    fireEvent.change(screen.getByRole('textbox', { name: /Agronomická fakulta/ }), {
      target: { value: 'not a code' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(saveAdminStudyAids).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Agronomická fakulta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(saveAdminStudyAids).not.toHaveBeenCalled();
  });

  it('says so when the list could not be read', () => {
    useAppStore.setState({ adminStudyAids: null, adminStudyAidsLoading: false } as any);
    render(<StudyAidsPanel />);
    expect(screen.getByText(/Nepodařilo se načíst/)).toBeInTheDocument();
  });

  // Reopening Otázky shows the list the store still holds while a new read runs.
  // When that read changes a row, the editor must follow it: it used to keep
  // the first values in its own state, so a later Save wrote the old switch back.
  it('follows the list when a fresh read changes the row, instead of keeping stale fields', () => {
    render(<StudyAidsPanel />);
    expect(screen.getByRole('checkbox', { name: 'Zobrazovat studentům' })).not.toBeChecked();
    act(() => {
      useAppStore.setState({
        adminStudyAids: [{ id: 'mendelu-app', audience: ['af:N-TZO'], isActive: true }],
      } as any);
    });
    expect(screen.getByRole('checkbox', { name: 'Zobrazovat studentům' })).toBeChecked();
    expect(
      screen.getByRole('textbox', { name: /Agronomická fakulta/ }) as HTMLInputElement
    ).toHaveValue('N-TZO');
  });

  it('keeps what the admin is typing while nothing changes on the server', () => {
    render(<StudyAidsPanel />);
    fireEvent.change(screen.getByRole('textbox', { name: /Agronomická fakulta/ }), {
      target: { value: 'B-ATE, N-TZO' },
    });
    act(() => {
      // A reload that brings back the very same row.
      useAppStore.setState({
        adminStudyAids: [
          { id: 'mendelu-app', audience: ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'], isActive: false },
        ],
      } as any);
    });
    expect(
      screen.getByRole('textbox', { name: /Agronomická fakulta/ }) as HTMLInputElement
    ).toHaveValue('B-ATE, N-TZO');
  });

  it('clears the error as soon as the admin corrects the input', () => {
    render(<StudyAidsPanel />);
    const programmes = screen.getByRole('textbox', { name: /Agronomická fakulta/ });
    fireEvent.change(programmes, { target: { value: 'not a code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(programmes, { target: { value: 'B-ATE' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // The store holds null until the first read lands: that is loading, not failure.
  it('shows loading, not a failure, while the first read is pending', () => {
    useAppStore.setState({ adminStudyAids: null, adminStudyAidsLoading: true } as any);
    render(<StudyAidsPanel />);
    expect(screen.getByText('Načítám…')).toBeInTheDocument();
    expect(screen.queryByText(/Nepodařilo se načíst/)).toBeNull();
  });

  it('does not let Save write cached values while a fresh read is on its way', () => {
    useAppStore.setState({ adminStudyAidsLoading: true } as any);
    render(<StudyAidsPanel />);
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });
});
