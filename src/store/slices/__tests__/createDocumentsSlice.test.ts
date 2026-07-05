import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

beforeEach(() => { useAppStore.setState({ isDocumentsOpen: false }); });

describe('documents slice', () => {
  it('defaults isDocumentsOpen to false', () => {
    expect(useAppStore.getState().isDocumentsOpen).toBe(false);
  });
  it('setIsDocumentsOpen toggles the flag', () => {
    useAppStore.getState().setIsDocumentsOpen(true);
    expect(useAppStore.getState().isDocumentsOpen).toBe(true);
    useAppStore.getState().setIsDocumentsOpen(false);
    expect(useAppStore.getState().isDocumentsOpen).toBe(false);
  });
});
