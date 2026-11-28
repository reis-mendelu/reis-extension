import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PersonasSheet } from '../PersonasSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { overlayWrite } from '../../../../store/overlay/overlayGuard';

/** The phone's "Zobrazit jako", opened from the admin's avatar (decision #16). */
describe('PersonasSheet', () => {
  const onClose = vi.fn();
  const replaceSheet = vi.fn();
  const loadOptions = vi.fn(async () => {});

  beforeEach(() => {
    onClose.mockClear();
    replaceSheet.mockClear();
    loadOptions.mockClear();
    useAppStore.setState(
      overlayWrite({
        language: 'cz' as const,
        adminRole: 'reis_admin' as const,
        impersonation: null,
        personaRows: {},
        replaceSheet,
        loadImpersonationOptions: loadOptions,
      })
    );
  });

  it('says what it is once, in its header', () => {
    render(<PersonasSheet onClose={onClose} />);
    expect(screen.getAllByText('Zobrazit jako')).toHaveLength(1);
    expect(screen.getByRole('radiogroup', { name: 'Zobrazit jako' })).toBeInTheDocument();
  });

  it('picking a persona applies it and closes the sheet', async () => {
    const go = vi.fn(async () => true);
    useAppStore.setState({ switchToPersona: go });
    render(<PersonasSheet onClose={onClose} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /IT · B-OI/ }));
    });
    expect(go).toHaveBeenCalledWith('it');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open when the switch fails', async () => {
    useAppStore.setState({ switchToPersona: vi.fn(async () => false) });
    render(<PersonasSheet onClose={onClose} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /IT · B-OI/ }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Já closes it too', async () => {
    render(<PersonasSheet onClose={onClose} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /Já/ }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('"Jiný obor…" puts the picker sheet in its place', () => {
    render(<PersonasSheet onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: /Jiný obor/ }));
    expect(loadOptions).toHaveBeenCalledOnce();
    expect(replaceSheet).toHaveBeenCalledWith({ kind: 'impersonation' });
  });
});
