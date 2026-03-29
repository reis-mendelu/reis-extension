import type { AppSlice, CourseTipsSlice } from '../types';
import { getUserParams } from '../../utils/userParams';
import {
    submitCourseTip,
    fetchCourseTips,
    fetchMyCourseTip,
    deleteCourseTip,
} from '../../api/courseTips';

export const createCourseTipsSlice: AppSlice<CourseTipsSlice> = (set, get) => ({
    courseTips: {},
    myTips: {},
    tipsLoading: {},

    fetchCourseTips: async (courseCode: string) => {
        if (get().tipsLoading[courseCode]) return;
        set({ tipsLoading: { ...get().tipsLoading, [courseCode]: true } });

        const userParams = await getUserParams();
        if (!userParams) {
            set({ tipsLoading: { ...get().tipsLoading, [courseCode]: false } });
            return;
        }

        const semester = userParams.obdobi;
        const [tips, myTip] = await Promise.all([
            fetchCourseTips(courseCode, semester),
            fetchMyCourseTip(userParams.studentId, courseCode, semester),
        ]);

        set({
            courseTips: { ...get().courseTips, [courseCode]: tips },
            myTips: myTip !== null
                ? { ...get().myTips, [courseCode]: myTip }
                : get().myTips,
            tipsLoading: { ...get().tipsLoading, [courseCode]: false },
        });
    },

    submitTip: async (courseCode: string, tipText: string) => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const prevTips = get().courseTips[courseCode] ?? [];
        const prevMyTip = get().myTips[courseCode];

        // Optimistic: add/replace tip in local list
        const newTip = { tipText, createdAt: new Date().toISOString() };
        const withoutMine = prevMyTip
            ? prevTips.filter(t => t.tipText !== prevMyTip)
            : prevTips;

        set({
            myTips: { ...get().myTips, [courseCode]: tipText },
            courseTips: { ...get().courseTips, [courseCode]: [newTip, ...withoutMine] },
        });

        const ok = await submitCourseTip(userParams.studentId, courseCode, userParams.obdobi, tipText);
        if (!ok) {
            // Revert
            const revertTips = { ...get().courseTips, [courseCode]: prevTips };
            const revertMy = { ...get().myTips };
            if (prevMyTip !== undefined) revertMy[courseCode] = prevMyTip;
            else delete revertMy[courseCode];
            set({ courseTips: revertTips, myTips: revertMy });
        }
    },

    deleteTip: async (courseCode: string) => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const prevTips = get().courseTips[courseCode] ?? [];
        const prevMyTip = get().myTips[courseCode];
        if (!prevMyTip) return;

        // Optimistic: remove from list
        const withoutMine = prevTips.filter(t => t.tipText !== prevMyTip);
        const revertMy = { ...get().myTips };
        delete revertMy[courseCode];

        set({
            myTips: revertMy,
            courseTips: { ...get().courseTips, [courseCode]: withoutMine },
        });

        const ok = await deleteCourseTip(userParams.studentId, courseCode, userParams.obdobi);
        if (!ok) {
            // Revert
            set({
                myTips: { ...get().myTips, [courseCode]: prevMyTip },
                courseTips: { ...get().courseTips, [courseCode]: prevTips },
            });
        }
    },
});
