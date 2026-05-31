import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNoteImage } from '../useNoteImage';
import * as store from '../../../services/notes/noteImageStore';

describe('useNoteImage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });
    });

    it('resolves a blob URL for a known hash', async () => {
        vi.spyOn(store, 'getImage').mockResolvedValue({
            hash: 'h', blob: new Blob(['x']), mime: 'image/jpeg', w: 1, h: 1, createdAt: 0,
        });
        const { result } = renderHook(() => useNoteImage('h'));
        await waitFor(() => expect(result.current).toBe('blob:fake'));
    });

    it('returns null for a missing hash', async () => {
        vi.spyOn(store, 'getImage').mockResolvedValue(undefined);
        const { result } = renderHook(() => useNoteImage('missing'));
        await waitFor(() => expect(result.current).toBeNull());
    });
});
