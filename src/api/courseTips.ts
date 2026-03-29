import { supabase } from '../services/spolky/supabaseClient';

async function hashId(raw: string): Promise<string> {
    const data = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface CourseTip {
    tipText: string;
    createdAt: string;
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
    courseCode: string,
    semesterCode: string,
): Promise<CourseTip[]> {
    const { data, error } = await supabase.rpc('get_course_tips', {
        p_course_code: courseCode,
        p_semester_code: semesterCode,
    });
    if (error || !data) return [];
    return (data as { tip_text: string; created_at: string }[]).map(row => ({
        tipText: row.tip_text,
        createdAt: row.created_at,
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
