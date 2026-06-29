import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRsvpSlice, type RsvpSlice } from '../createRsvpSlice';

describe('createRsvpSlice', () => {
  let state: RsvpSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createRsvpSlice(set, get, {} as any);
  });

  it('starts with no responses', () => {
    expect(state.rsvp).toEqual({});
  });

  it('records a Going response', () => {
    state.setRsvp('e1', 'going');
    expect(state.rsvp.e1).toBe('going');
  });

  it('switches between Going and Interested', () => {
    state.setRsvp('e1', 'going');
    state.setRsvp('e1', 'interested');
    expect(state.rsvp.e1).toBe('interested');
  });

  it('tapping the active status clears the RSVP', () => {
    state.setRsvp('e1', 'going');
    state.setRsvp('e1', 'going');
    expect(state.rsvp.e1).toBeUndefined();
  });

  it('keeps per-event responses independent', () => {
    state.setRsvp('e1', 'going');
    state.setRsvp('e2', 'interested');
    expect(state.rsvp).toEqual({ e1: 'going', e2: 'interested' });
  });
});
