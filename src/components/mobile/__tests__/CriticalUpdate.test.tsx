import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const open = vi.fn(async (_signal?: string) => {});
vi.mock('../../../mobile/appUpdate', () => ({ openAppUpdate: (s?: string) => open(s) }));

import { CriticalUpdateDialog } from '../CriticalUpdateDialog';
import { CriticalUpdateHint } from '../CriticalUpdateHint';
import { useAppStore } from '../../../store/useAppStore';
import { useEscapeLayer, hasOpenEscapeLayer } from '../../../hooks/ui/useEscapeLayer';

/**
 * The critical-version pop-up and its empty-screen hint (agreed 2026-11-20):
 * they say why the app misbehaves, offer the update, and never stand in the
 * way. The store decides when (src/mobile/criticalUpdate); here only what the
 * student sees and can do.
 */
const critical = {
  minVersion: '5.7.0',
  reason: { cz: 'IS Mendelu změnil vzhled.', en: 'IS Mendelu changed its look.' },
};

function reset(over: Record<string, unknown> = {}) {
  useAppStore.setState({
    language: 'cz',
    criticalUpdate: critical,
    criticalPopupOpen: true,
    ...over,
  } as never);
}

describe('CriticalUpdateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
  });

  it('says what happened, in the app language', () => {
    render(<CriticalUpdateDialog />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Je tu opravená verze reISu')).toBeTruthy();
    expect(screen.getByText('IS Mendelu změnil vzhled.')).toBeTruthy();
  });

  it('switches the reason with the language', () => {
    reset({ language: 'en' });
    render(<CriticalUpdateDialog />);
    expect(screen.getByText('IS Mendelu changed its look.')).toBeTruthy();
  });

  it('opens the store under its own counter and closes', () => {
    render(<CriticalUpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Aktualizovat' }));
    expect(open).toHaveBeenCalledWith('critical_update_opened');
    expect(useAppStore.getState().criticalPopupOpen).toBe(false);
  });

  it('always lets the student carry on: "Teď ne" and a tap outside both close it', () => {
    render(<CriticalUpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Teď ne' }));
    expect(useAppStore.getState().criticalPopupOpen).toBe(false);
    expect(open).not.toHaveBeenCalled();

    reset();
    render(<CriticalUpdateDialog />);
    fireEvent.click(screen.getAllByTestId('critical-update-backdrop')[0]!);
    expect(useAppStore.getState().criticalPopupOpen).toBe(false);
  });

  it('works from a keyboard: focus starts on Update, Tab stays inside, Escape closes', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    const { rerender } = render(<CriticalUpdateDialog />);
    const update = screen.getByRole('button', { name: 'Aktualizovat' });
    const later = screen.getByRole('button', { name: 'Teď ne' });
    expect(document.activeElement).toBe(update);

    later.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(update);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(later);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().criticalPopupOpen).toBe(false);
    rerender(<CriticalUpdateDialog />);
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('Escape closes only the pop-up when it opens over another window', () => {
    const under = vi.fn();
    function Underneath() {
      useEscapeLayer(true, under);
      return null;
    }
    reset({ criticalPopupOpen: false });
    const { rerender } = render(
      <>
        <Underneath />
        <CriticalUpdateDialog />
      </>
    );
    // Opens later, on resume, over what is already there.
    useAppStore.getState().openCriticalPopup();
    rerender(
      <>
        <Underneath />
        <CriticalUpdateDialog />
      </>
    );
    expect(hasOpenEscapeLayer()).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().criticalPopupOpen).toBe(false);
    expect(under).not.toHaveBeenCalled();
  });

  it('shows nothing on a working install', () => {
    reset({ criticalUpdate: null });
    render(<CriticalUpdateDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clearing the critical version closes an open pop-up', () => {
    useAppStore.getState().setCriticalUpdate(null);
    expect(useAppStore.getState().criticalPopupOpen).toBe(false);
  });
});

describe('CriticalUpdateHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset({ criticalPopupOpen: false });
  });

  it('explains the empty list and offers the update', () => {
    render(<CriticalUpdateHint />);
    expect(screen.getByTestId('critical-update-hint').textContent).toContain(
      'IS Mendelu změnil vzhled.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aktualizovat' }));
    expect(open).toHaveBeenCalledWith('critical_update_opened');
  });

  it('is absent on a working install', () => {
    reset({ criticalUpdate: null });
    render(<CriticalUpdateHint />);
    expect(screen.queryByTestId('critical-update-hint')).toBeNull();
  });
});
