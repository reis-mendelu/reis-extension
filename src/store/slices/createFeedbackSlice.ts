import type { AppSlice } from '../types';
import type { FeedbackSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { submitFeedback } from '../../api/feedback';
import { getUserParams } from '../../utils/userParams';

const FEEDBACK_KEY = 'reis_feedback';
const SESSIONS_UNTIL_ELIGIBLE = 3;

function getCurrentSemesterCode(obdobi: string): string {
    return obdobi;
}

export const createFeedbackSlice: AppSlice<FeedbackSlice> = (set) => ({
    feedbackEligible: false,
    feedbackDismissed: false,

    loadFeedbackState: async () => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const currentSemester = getCurrentSemesterCode(userParams.obdobi);
        const record = await IndexedDBService.get('meta', FEEDBACK_KEY) as {
            sessionsUntilEligible?: number;
            npsSubmittedSemester?: string;
            dismissedSemester?: string;
        } | undefined;

        if (!record) {
            await IndexedDBService.set('meta', FEEDBACK_KEY, {
                sessionsUntilEligible: SESSIONS_UNTIL_ELIGIBLE - 1,
            });
            return;
        }

        if (record.npsSubmittedSemester === currentSemester) {
            set({ feedbackDismissed: true });
            return;
        }

        if (record.dismissedSemester === currentSemester) {
            set({ feedbackDismissed: true });
            return;
        }

        const remaining = record.sessionsUntilEligible ?? 0;
        if (remaining > 0) {
            await IndexedDBService.set('meta', FEEDBACK_KEY, {
                ...record,
                sessionsUntilEligible: remaining - 1,
            });
            return;
        }

        set({ feedbackEligible: true });
    },

    submitNps: async (rating: number) => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const currentSemester = getCurrentSemesterCode(userParams.obdobi);
        await submitFeedback(
            userParams.studentId,
            'nps',
            String(rating),
            currentSemester,
        );

        const record = await IndexedDBService.get('meta', FEEDBACK_KEY) as Record<string, unknown> | undefined;
        await IndexedDBService.set('meta', FEEDBACK_KEY, {
            ...record,
            npsSubmittedSemester: currentSemester,
        });

        set({ feedbackEligible: false, feedbackDismissed: true });
    },

    dismissFeedback: async () => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const currentSemester = getCurrentSemesterCode(userParams.obdobi);
        const record = await IndexedDBService.get('meta', FEEDBACK_KEY) as Record<string, unknown> | undefined;
        await IndexedDBService.set('meta', FEEDBACK_KEY, {
            ...record,
            dismissedSemester: currentSemester,
        });

        set({ feedbackEligible: false, feedbackDismissed: true });
    },
});
