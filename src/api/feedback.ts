import { supabase } from '../services/spolky/supabaseClient';
import { useAppStore } from '../store/useAppStore';

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
    reason?: string,
): Promise<boolean> {
    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('submit_feedback', {
        p_student_id: hashedId,
        p_faculty_id: null,
        p_study_semester: null,
        p_feedback_type: feedbackType,
        p_value: value,
        p_semester_code: semesterCode,
        p_reason: reason ?? null,
    });
    if (error) return false;

    return true;
}

export async function trackDailyUsage(studentId: string): Promise<void> {
    // The demo student is fabricated, so this would send a hash of a fiction.
    // The Data safety and App Privacy filings both describe this row as a hash
    // of a real student identifier — keep that literally true.
    if (useAppStore.getState().demoMode) return;

    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('track_daily_usage', {
        p_student_id: hashedId,
    });
    if (error) return;

}
