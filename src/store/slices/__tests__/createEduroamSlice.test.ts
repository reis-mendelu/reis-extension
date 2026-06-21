import { describe, it, expect, afterEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

afterEach(() => {
  useAppStore.setState({ isEduroamOpen: false });
});

describe('createEduroamSlice', () => {
  it('defaults isEduroamOpen to false', () => {
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });

  it('setIsEduroamOpen toggles the flag', () => {
    useAppStore.getState().setIsEduroamOpen(true);
    expect(useAppStore.getState().isEduroamOpen).toBe(true);
    useAppStore.getState().setIsEduroamOpen(false);
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });
});
