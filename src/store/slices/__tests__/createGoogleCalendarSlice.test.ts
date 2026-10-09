import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import { createGoogleCalendarSlice } from '../createGoogleCalendarSlice';
import type { GoogleCalendarSlice } from '../../types';

describe('createGoogleCalendarSlice', () => {
  it('starts disconnected and merges patches', () => {
    const s = create<GoogleCalendarSlice>()((set, get, api) =>
      createGoogleCalendarSlice(set as never, get as never, api as never)
    );
    expect(s.getState().gcal).toMatchObject({ connected: false, syncing: false, notice: null });
    s.getState().setGcal({ connected: true, email: 'a@b' });
    expect(s.getState().gcal).toMatchObject({ connected: true, email: 'a@b', syncing: false });
  });
});
