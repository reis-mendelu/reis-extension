/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    useAppStore.setState({ adminStudyAids: null } as any);
    render(<StudyAidsPanel />);
    expect(screen.getByText(/Nepodařilo se načíst/)).toBeInTheDocument();
  });
});
