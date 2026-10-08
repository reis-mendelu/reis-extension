import { describe, it, expect, vi, beforeEach } from 'vitest';

const trackEventSignal = vi.hoisted(() => vi.fn());
vi.mock('../../../api/eventSignals', () => ({ trackEventSignal }));

import { useAppStore } from '../../useAppStore';
import type { MapEvent } from '../../../types/events';

/**
 * Opened is counted where every surface opens an event — a pin, a list row,
 * the peek band, a Novinky row — so none of them can be missed (spec
 * 2026-10-08). A society checking its own listing in the console is not a
 * student opening it.
 */
const ev = { id: 'e1', date: '2099-01-01', coord: null } as unknown as MapEvent;

describe('focusEventById counts Opened', () => {
  beforeEach(() => {
    trackEventSignal.mockClear();
    useAppStore.setState({ mapEvents: [ev], societyMapEvents: [ev], adminConsoleOpen: false });
  });

  it('on the student map', () => {
    useAppStore.getState().focusEventById('e1');
    expect(trackEventSignal).toHaveBeenCalledWith('e1', 'opened');
  });

  it('not in the admin console', () => {
    useAppStore.setState({ adminConsoleOpen: true });
    useAppStore.getState().focusEventById('e1');
    expect(trackEventSignal).not.toHaveBeenCalled();
  });

  it('not for an unknown event', () => {
    useAppStore.getState().focusEventById('nope');
    expect(trackEventSignal).not.toHaveBeenCalled();
  });
});
