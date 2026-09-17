import { describe, it, expect, afterEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

afterEach(() => {
  useAppStore.setState({ isEduroamOpen: false, eduroamInitialTarget: null });
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

  it('openEduroamFor opens on one device; a plain open clears it', () => {
    useAppStore.getState().openEduroamFor('windows');
    expect(useAppStore.getState()).toMatchObject({
      isEduroamOpen: true,
      eduroamInitialTarget: 'windows',
    });
    useAppStore.getState().setIsEduroamOpen(true);
    expect(useAppStore.getState().eduroamInitialTarget).toBeNull();
  });
});
