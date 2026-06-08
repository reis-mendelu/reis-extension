import { describe, it, expect } from 'vitest';
import { shouldShowExamsSkeleton } from '../useExamsData';

const base = {
    examsCount: 0,
    status: 'success' as const,
    handshakeDone: true,
    handshakeTimedOut: false,
    isSyncing: false,
    examsRefreshing: false,
};

describe('shouldShowExamsSkeleton', () => {
    it('shows the empty state (no skeleton) once everything settled with no exams and no refresh', () => {
        expect(shouldShowExamsSkeleton(base)).toBe(false);
    });

    it('keeps the skeleton up while a panel-triggered refresh is in flight, even after sync settled (the open-panel flash bug)', () => {
        // status success, handshake done, not syncing — but the panel just fired its
        // mount refresh. Without examsRefreshing in the rule this falls through to
        // "nothing to display".
        expect(shouldShowExamsSkeleton({ ...base, examsRefreshing: true })).toBe(true);
    });

    it('shows the skeleton while initially loading / before handshake / while syncing', () => {
        expect(shouldShowExamsSkeleton({ ...base, status: 'loading' })).toBe(true);
        expect(shouldShowExamsSkeleton({ ...base, status: 'idle' })).toBe(true);
        expect(shouldShowExamsSkeleton({ ...base, handshakeDone: false })).toBe(true);
        expect(shouldShowExamsSkeleton({ ...base, isSyncing: true })).toBe(true);
    });

    it('never shows the skeleton once exams are present', () => {
        expect(shouldShowExamsSkeleton({ ...base, examsCount: 3, examsRefreshing: true, isSyncing: true })).toBe(false);
    });

    it('shows the empty state after the handshake timed out with no exams', () => {
        expect(shouldShowExamsSkeleton({ ...base, handshakeDone: false, handshakeTimedOut: true })).toBe(false);
    });
});
