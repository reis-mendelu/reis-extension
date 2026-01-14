/**
 * Tests for useSubjectNote hook
 * 
 * Pre-Mortem Tests encoding The 4 Deaths:
 * - Edge Case: undefined subjectCode, empty note
 * - Integration: storage read/write errors  
 * - User Error: typing faster than debounce, exceeding char limit
 * - Time: debounce timing, subject switching during async load
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSubjectNote } from './useSubjectNote';

// Access the global chrome mock from setup.ts
const mockStorage: Record<string, unknown> = {};

describe('useSubjectNote', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear mock storage
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        
        // Configure mock implementations for this test suite
        vi.mocked(chrome.storage.sync.get).mockImplementation(((keys: string | string[] | Record<string, unknown> | null | undefined) => {
            if (typeof keys === 'string') {
                return Promise.resolve({ [keys]: mockStorage[keys] });
            }
            return Promise.resolve(mockStorage);
        }) as any);
        vi.mocked(chrome.storage.sync.set).mockImplementation((items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
            return Promise.resolve();
        });
    });

    describe('initialization', () => {
        it('should return empty string when no note exists', async () => {
            const { result } = renderHook(() => useSubjectNote('TZI'));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.note).toBe('');
        });

        it('should load existing note from storage', async () => {
            mockStorage['note:EBC-AP'] = { note: 'Prof. likes examples', updatedAt: Date.now() };

            const { result } = renderHook(() => useSubjectNote('EBC-AP'));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.note).toBe('Prof. likes examples');
        });

        it('should handle undefined subjectCode gracefully', async () => {
            const { result } = renderHook(() => useSubjectNote(undefined));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.note).toBe('');
            expect(chrome.storage.sync.get).not.toHaveBeenCalled();
        });
    });

    describe('setNote', () => {
        it('should update note in state immediately', async () => {
            const { result } = renderHook(() => useSubjectNote('TZI'));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.setNote('New note');
            });

            expect(result.current.note).toBe('New note');
        });

        it('should enforce 500 character limit', async () => {
            const { result } = renderHook(() => useSubjectNote('TZI'));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const longNote = 'a'.repeat(600);

            act(() => {
                result.current.setNote(longNote);
            });

            // Should truncate to 500 characters
            expect(result.current.note.length).toBe(500);
        });
    });

    describe('debounced save', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should not save immediately', async () => {
            // Setup sync mock before using fake timers
            const { result } = renderHook(() => useSubjectNote('TZI'));

            // Wait for initial load with fake timers
            await vi.runAllTimersAsync();

            act(() => {
                result.current.setNote('First');
            });

            // Should not save immediately
            expect(chrome.storage.sync.set).not.toHaveBeenCalled();
        });

        it('should save after 800ms debounce', async () => {
            const { result } = renderHook(() => useSubjectNote('TZI'));

            await vi.runAllTimersAsync();

            act(() => {
                result.current.setNote('Test note');
            });

            // Advance past debounce
            await act(async () => {
                await vi.advanceTimersByTimeAsync(800);
            });

            expect(chrome.storage.sync.set).toHaveBeenCalledWith({
                'note:TZI': expect.objectContaining({
                    note: 'Test note',
                }),
            });
        });

        it('should flush pending save on unmount', async () => {
            const { result, unmount } = renderHook(() => useSubjectNote('TZI'));

            await vi.runAllTimersAsync();

            act(() => {
                result.current.setNote('Unmount note');
            });

            // Unmount immediately without advancing time
            unmount();

            // Should have saved immediately on unmount
            expect(chrome.storage.sync.set).toHaveBeenCalledWith({
                'note:TZI': expect.objectContaining({
                    note: 'Unmount note',
                }),
            });
        });
    });

    describe('subject switching', () => {
        it('should reload note when subjectCode changes', async () => {
            mockStorage['note:TZI'] = { note: 'TZI note', updatedAt: Date.now() };
            mockStorage['note:EBC-AP'] = { note: 'EBC note', updatedAt: Date.now() };

            const { result, rerender } = renderHook(
                ({ code }) => useSubjectNote(code),
                { initialProps: { code: 'TZI' } }
            );

            await waitFor(() => {
                expect(result.current.note).toBe('TZI note');
            });

            rerender({ code: 'EBC-AP' });

            await waitFor(() => {
                expect(result.current.note).toBe('EBC note');
            });
        });
    });

    describe('error handling', () => {
        it('should handle storage read errors gracefully', async () => {
            vi.mocked(chrome.storage.sync.get).mockRejectedValueOnce(new Error('Storage error'));

            const { result } = renderHook(() => useSubjectNote('TZI'));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Should fallback to empty string
            expect(result.current.note).toBe('');
        });
    });
});
