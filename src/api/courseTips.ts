import { supabase } from '../services/spolky/supabaseClient';

async function hashId(raw: string): Promise<string> {
    const data = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface CourseTip {
    tipId: number;
    tipText: string;
    createdAt: string;
    helpfulCount: number;
    votedByMe: boolean;
}

export async function submitCourseTip(
    studentId: string,
    courseCode: string,
    semesterCode: string,
    tipText: string,
): Promise<boolean> {
    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('submit_course_tip', {
        p_student_id: hashedId,
        p_course_code: courseCode,
        p_semester_code: semesterCode,
        p_tip_text: tipText,
    });
    return !error;
}

export async function fetchCourseTips(
    studentId: string,
    courseCode: string,
    semesterCode: string,
): Promise<CourseTip[]> {
    const hashedId = await hashId(studentId);
    const { data, error } = await supabase.rpc('get_course_tips_with_votes', {
        p_course_code: courseCode,
        p_semester_code: semesterCode,
        p_student_id: hashedId,
    });
    if (error || !data) return [];
    return (data as { tip_id: number; tip_text: string; created_at: string; helpful_count: number; voted_by_me: boolean }[]).map(row => ({
        tipId: row.tip_id,
        tipText: row.tip_text,
        createdAt: row.created_at,
        helpfulCount: Number(row.helpful_count),
        votedByMe: row.voted_by_me,
    }));
}

export async function fetchMyCourseTip(
    studentId: string,
    courseCode: string,
    semesterCode: string,
): Promise<string | null> {
    const hashedId = await hashId(studentId);
    const { data, error } = await supabase.rpc('get_my_course_tip', {
        p_student_id: hashedId,
        p_course_code: courseCode,
        p_semester_code: semesterCode,
    });
    if (error) return null;
    return data as string | null;
}

export async function deleteCourseTip(
    studentId: string,
    courseCode: string,
    semesterCode: string,
): Promise<boolean> {
    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('delete_course_tip', {
        p_student_id: hashedId,
        p_course_code: courseCode,
        p_semester_code: semesterCode,
    });
    return !error;
}

export async function voteTipHelpful(
    studentId: string,
    tipId: number,
): Promise<boolean | null> {
    const hashedId = await hashId(studentId);
    const { data, error } = await supabase.rpc('vote_tip_helpful', {
        p_student_id: hashedId,
        p_tip_id: tipId,
    });
    if (error) return null;
    return data as boolean;
}
