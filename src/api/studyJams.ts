import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { logError } from '../utils/reportError';

// Supabase results are `any`-typed; validate row shapes before use so a schema
// drift or bad row can't corrupt UI state. On failure we fall back to the same
// empty/null result as the error path.
const KillerCourseSchema = z.object({ course_code: z.string(), course_name: z.string() });
const RoleSchema = z.enum(['tutor', 'tutee']);
const TutoringMatchSchema = z.object({
    tutor_student_id: z.string(), tutee_student_id: z.string(), course_code: z.string(),
});
const AvailabilitySchema = z.object({ course_code: z.string(), role: RoleSchema });
const DismissalSchema = z.object({ course_code: z.string() });

export async function fetchKillerCourses(): Promise<{ course_code: string; course_name: string }[]> {
    const { data, error } = await supabase
        .from('killer_courses')
        .select('course_code, course_name')
        .eq('is_active', true);
    if (error) return [];

    const parsed = z.array(KillerCourseSchema).safeParse(data ?? []);
    if (!parsed.success) { logError('Api.fetchKillerCourses', parsed.error); return []; }
    return parsed.data;
}

export async function registerAvailability(
    studentId: string,
    courseCode: string,
    role: 'tutor' | 'tutee',
): Promise<boolean> {
    const { error } = await supabase.rpc('register_study_jam_availability', {
        p_student_id: studentId,
        p_course_code: courseCode,
        p_role: role,
    });
    if (error) return false;

    return true;
}

export async function fetchMyTutoringMatch(
    studentId: string,
): Promise<{ tutor_student_id: string; tutee_student_id: string; course_code: string } | null> {
    const { data, error } = await supabase
        .from('tutoring_matches')
        .select('tutor_student_id, tutee_student_id, course_code')
        .or(`tutor_student_id.eq.${studentId},tutee_student_id.eq.${studentId}`)
        .limit(1)
        .maybeSingle();
    if (error || data == null) return null;

    const parsed = TutoringMatchSchema.safeParse(data);
    if (!parsed.success) { logError('Api.fetchMyTutoringMatch', parsed.error); return null; }
    return parsed.data;
}

export async function fetchMyAvailability(studentId: string): Promise<{ course_code: string; role: 'tutor' | 'tutee' }[]> {
    const { data, error } = await supabase
        .from('study_jam_availability')
        .select('course_code, role')
        .eq('student_id', studentId);
    if (error) return [];

    const parsed = z.array(AvailabilitySchema).safeParse(data ?? []);
    if (!parsed.success) { logError('Api.fetchMyAvailability', parsed.error); return []; }
    return parsed.data;
}

export async function deleteAvailability(studentId: string, courseCode: string): Promise<void> {
    const { error } = await supabase.rpc('delete_study_jam_availability', {
        p_student_id: studentId,
        p_course_code: courseCode,
    });
    if (error) return;

}

export async function dismissStudyJam(studentId: string, courseCode: string): Promise<boolean> {
    const { error } = await supabase.rpc('dismiss_study_jam_suggestion', {
        p_student_id: studentId,
        p_course_code: courseCode,
    });
    if (error) return false;

    return true;
}

export async function withdrawMatch(studentId: string, courseCode: string): Promise<void> {
    const { error } = await supabase.rpc('withdraw_study_jam_match', {
        p_student_id: studentId,
        p_course_code: courseCode,
    });
    if (error) return;

}

export async function fetchMyDismissals(studentId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('study_jam_dismissals')
        .select('course_code')
        .eq('student_id', studentId);
    if (error) return [];

    const parsed = z.array(DismissalSchema).safeParse(data ?? []);
    if (!parsed.success) { logError('Api.fetchMyDismissals', parsed.error); return []; }
    return parsed.data.map(r => r.course_code);
}
