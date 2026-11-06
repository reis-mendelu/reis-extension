import { describe, it, expect } from 'vitest';
import { groupFocusView, GROUP_FOCUS_MAX_ZOOM } from '../focusBounds';

describe('groupFocusView', () => {
  it('frames the group itself, closer than a building fit, clear of the search bar', () => {
    const v = groupFocusView('box');
    expect(v.bounds).toBe('box');
    expect(v.maxZoom).toBe(GROUP_FOCUS_MAX_ZOOM);
    expect(v.paddingTopLeft[1]).toBeGreaterThan(v.paddingBottomRight[1]);
  });
  it('keeps clear of the tablet rail on the right', () => {
    expect(groupFocusView('box', 300).paddingBottomRight[0]).toBe(332);
  });
});
