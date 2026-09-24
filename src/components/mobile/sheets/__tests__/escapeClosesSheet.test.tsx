import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SheetHost } from '../SheetHost';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Escape closes the top sheet, one level per press — the keyboard's version of
 * Android's back (mobile/backButton.ts).
 *
 * The phone tree reaches a hardware keyboard on two devices: an iPad with one
 * attached, and every Mac, where the iPad app is the whole product. There
 * Escape is how a dialog closes, and without it the only way out of a sheet was
 * to aim the pointer at the dimmed strip above it.
 */
const SUBJECT = { kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' };

describe('Escape and the sheet stack', () => {
  beforeEach(() => {
    useAppStore.setState({
      mobileSheets: [],
      reportOpen: false,
      language: 'cz',
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: '', data: {} },
    } as never);
  });

  it('pops exactly one sheet per press', () => {
    useAppStore.setState({ mobileSheets: [SUBJECT, { kind: 'notifications' }] } as never);
    render(<SheetHost />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().mobileSheets).toEqual([SUBJECT]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().mobileSheets).toEqual([]);
  });

  it('does nothing with no sheet open', () => {
    render(<SheetHost />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().mobileSheets).toEqual([]);
  });

  it('leaves an Escape that something inside already answered', () => {
    // The search list uses Escape to drop its highlighted row first.
    useAppStore.setState({ mobileSheets: [SUBJECT] } as never);
    render(<SheetHost />);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);
    expect(useAppStore.getState().mobileSheets).toEqual([SUBJECT]);
  });

  it('closes the feedback form before the sheet under it', () => {
    // The report form opens over a sheet (failed exam actions, empty states).
    useAppStore.setState({ mobileSheets: [SUBJECT], reportOpen: true } as never);
    render(<SheetHost />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().reportOpen).toBe(false);
    expect(useAppStore.getState().mobileSheets).toEqual([SUBJECT]);
  });

  it('ignores other keys', () => {
    useAppStore.setState({ mobileSheets: [SUBJECT] } as never);
    render(<SheetHost />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(useAppStore.getState().mobileSheets).toEqual([SUBJECT]);
  });
});
