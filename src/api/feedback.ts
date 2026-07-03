import { supabase } from '../services/spolky/supabaseClient';

async function hashId(raw: string): Promise<string> {
    const data = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function submitFeedback(
    studentId: string,
    feedbackType: 'nps' | 'one_change',
    value: string,
    semesterCode: string,
): Promise<boolean> {
    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('submit_feedback', {
        p_student_id: hashedId,
        p_faculty_id: null,
        p_study_semester: null,
        p_feedback_type: feedbackType,
        p_value: value,
        p_semester_code: semesterCode,
    });
    if (error) return false;

    return true;
}

export async function trackDailyUsage(studentId: string): Promise<void> {
    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('track_daily_usage', {
        p_student_id: hashedId,
    });
    if (error) return;

}
