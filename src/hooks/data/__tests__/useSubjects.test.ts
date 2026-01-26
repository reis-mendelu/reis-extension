import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubjects } from '../useSubjects';
import { useAppStore } from '../../../store/useAppStore';

// Mock the store
vi.mock('../../../store/useAppStore', () => ({
    useAppStore: vi.fn(),
}));

describe('useSubjects', () => {
    const mockSubjectsData = {
        data: {
            'EBC-AP': {
                courseCode: 'EBC-AP',
                fullName: 'Architektura počítačů',
                folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=12345',
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return subjects from store', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useAppStore).mockImplementation((selector: any) => {
            const state = {
                subjects: mockSubjectsData,
                subjectsLoading: false,
                syncStatus: { isSyncing: false }
            };
            return selector(state);
        });

        const { result } = renderHook(() => useSubjects());

        expect(result.current.subjects).toEqual(mockSubjectsData);
        expect(result.current.isLoaded).toBe(true);
    });

    it('should reflect loading state when store is loading or syncing', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useAppStore).mockImplementation((selector: any) => {
            const state = {
                subjects: null,
                subjectsLoading: true,
                syncStatus: { isSyncing: false }
            };
            return selector(state);
        });

        const { result } = renderHook(() => useSubjects());
        expect(result.current.isLoaded).toBe(false);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useAppStore).mockImplementation((selector: any) => {
            const state = {
                subjects: null,
                subjectsLoading: false,
                syncStatus: { isSyncing: true }
            };
            return selector(state);
        });

        const { result: result2 } = renderHook(() => useSubjects());
        expect(result2.current.isLoaded).toBe(false);
    });

    it('should return correct subject by course code', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useAppStore).mockImplementation((selector: any) => {
            const state = {
                subjects: mockSubjectsData,
                subjectsLoading: false,
                syncStatus: { isSyncing: false }
            };
            return selector(state);
        });

        const { result } = renderHook(() => useSubjects());
        const subject = result.current.getSubject('EBC-AP');
        expect(subject).toEqual(mockSubjectsData.data['EBC-AP']);
    });

    it('getSubject should return null when subject not found or store empty', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useAppStore).mockImplementation((selector: any) => {
            const state = {
                subjects: null,
                subjectsLoading: false,
                syncStatus: { isSyncing: false }
            };
            return selector(state);
        });

        const { result } = renderHook(() => useSubjects());
        expect(result.current.getSubject('ANY')).toBeNull();
    });
});
