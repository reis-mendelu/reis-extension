import { supabase } from '../services/spolky/supabaseClient';

async function hashId(raw: string): Promise<string> {
    const data = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface CourseRatingAggregate {
    totalCount: number;
    avgRating: number;
    distribution: [number, number, number, number];
}

export async function submitCourseRating(
    studentId: string,
    courseCode: string,
    semesterCode: string,
    rating: number,
): Promise<boolean> {
    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('submit_course_rating', {
        p_student_id: hashedId,
        p_course_code: courseCode,
        p_semester_code: semesterCode,
        p_rating: rating,
    });
    return !error;
}

export async function fetchCourseRatingAggregate(
    courseCode: string,
    semesterCode: string,
): Promise<CourseRatingAggregate | null> {
    const { data, error } = await supabase.rpc('get_course_rating_aggregate', {
        p_course_code: courseCode,
        p_semester_code: semesterCode,
    });
    if (error || !data || data.length === 0) return null;
    const row = data[0];
    if (Number(row.total_count) === 0) return null;
    return {
        totalCount: Number(row.total_count),
        avgRating: Number(row.avg_rating),
        distribution: [Number(row.rating_1), Number(row.rating_2), Number(row.rating_3), Number(row.rating_4)],
    };
}

export async function fetchMyCourseRating(
    studentId: string,
    courseCode: string,
    semesterCode: string,
): Promise<number | null> {
    const hashedId = await hashId(studentId);
    const { data, error } = await supabase.rpc('get_my_course_rating', {
        p_student_id: hashedId,
        p_course_code: courseCode,
        p_semester_code: semesterCode,
    });
    if (error) return null;
    return data as number | null;
}

export async function fetchCourseRatingsBatch(
    courseCodes: string[],
    semesterCode: string,
): Promise<Record<string, CourseRatingAggregate>> {
    if (courseCodes.length === 0) return {};
    const { data, error } = await supabase.rpc('get_course_ratings_batch', {
        p_course_codes: courseCodes,
        p_semester_code: semesterCode,
    });
    if (error || !data) return {};
    const result: Record<string, CourseRatingAggregate> = {};
    for (const row of data) {
        if (Number(row.total_count) > 0) {
            result[row.course_code] = {
                totalCount: Number(row.total_count),
                avgRating: Number(row.avg_rating),
                distribution: [Number(row.rating_1), Number(row.rating_2), Number(row.rating_3), Number(row.rating_4)],
            };
        }
    }
    return result;
}
