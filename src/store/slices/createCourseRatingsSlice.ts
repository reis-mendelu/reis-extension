import type { AppSlice, CourseRatingsSlice } from '../types';
import { getUserParams } from '../../utils/userParams';
import {
    submitCourseRating,
    fetchCourseRatingAggregate,
    fetchMyCourseRating,
    fetchCourseRatingsBatch,
} from '../../api/courseRatings';
import type { CourseRatingAggregate } from '../../api/courseRatings';

export const createCourseRatingsSlice: AppSlice<CourseRatingsSlice> = (set, get) => ({
    courseRatingAggregates: {},
    myRatings: {},
    ratingsLoading: {},

    fetchCourseRating: async (courseCode: string) => {
        if (get().ratingsLoading[courseCode]) return;
        set({ ratingsLoading: { ...get().ratingsLoading, [courseCode]: true } });

        const userParams = await getUserParams();
        if (!userParams) {
            set({ ratingsLoading: { ...get().ratingsLoading, [courseCode]: false } });
            return;
        }

        const semester = userParams.obdobi;
        const [aggregate, myRating] = await Promise.all([
            fetchCourseRatingAggregate(courseCode, semester),
            fetchMyCourseRating(userParams.studentId, courseCode, semester),
        ]);

        set({
            courseRatingAggregates: aggregate
                ? { ...get().courseRatingAggregates, [courseCode]: aggregate }
                : get().courseRatingAggregates,
            myRatings: myRating !== null
                ? { ...get().myRatings, [courseCode]: myRating }
                : get().myRatings,
            ratingsLoading: { ...get().ratingsLoading, [courseCode]: false },
        });
    },

    fetchCourseRatingsBatch: async (courseCodes: string[]) => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const result = await fetchCourseRatingsBatch(courseCodes, userParams.obdobi);
        set({ courseRatingAggregates: { ...get().courseRatingAggregates, ...result } });
    },

    submitRating: async (courseCode: string, rating: number) => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const prevAgg = get().courseRatingAggregates[courseCode];
        const prevMyRating = get().myRatings[courseCode];

        // Optimistic update
        const newAgg = computeOptimisticAggregate(prevAgg, prevMyRating, rating);
        set({
            myRatings: { ...get().myRatings, [courseCode]: rating },
            courseRatingAggregates: { ...get().courseRatingAggregates, [courseCode]: newAgg },
        });

        const ok = await submitCourseRating(userParams.studentId, courseCode, userParams.obdobi, rating);
        if (!ok) {
            // Revert on failure
            const revertAgg = prevAgg ? { ...get().courseRatingAggregates, [courseCode]: prevAgg } : get().courseRatingAggregates;
            const revertMy = { ...get().myRatings };
            if (prevMyRating !== undefined) revertMy[courseCode] = prevMyRating;
            else delete revertMy[courseCode];
            set({ courseRatingAggregates: revertAgg, myRatings: revertMy });
        }
    },
});

function computeOptimisticAggregate(
    prev: CourseRatingAggregate | undefined,
    prevRating: number | undefined,
    newRating: number,
): CourseRatingAggregate {
    const dist: [number, number, number, number] = prev
        ? [...prev.distribution]
        : [0, 0, 0, 0];

    if (prevRating !== undefined) {
        dist[prevRating - 1] = Math.max(0, dist[prevRating - 1] - 1);
    }
    dist[newRating - 1]++;

    const total = dist[0] + dist[1] + dist[2] + dist[3];
    const sum = dist[0] * 1 + dist[1] * 2 + dist[2] * 3 + dist[3] * 4;

    return {
        totalCount: total,
        avgRating: Math.round((sum / total) * 100) / 100,
        distribution: dist,
    };
}
