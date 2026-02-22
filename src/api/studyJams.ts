import { supabase } from '../services/spolky/supabaseClient';

export async function fetchKillerCourses(): Promise<{ course_code: string; course_name: string }[]> {
    const { data, error } = await supabase
        .from('killer_courses')
        .select('course_code, course_name')
        .eq('is_active', true);
    if (error) {
        console.error('[studyJams] fetchKillerCourses error', error);
        return [];
    }
    return data ?? [];
}

export async function registerAvailability(
    studentId: string,
    course_code: string,
    role: 'tutor' | 'tutee',
    semester_id: string,
): Promise<boolean> {
    const { error } = await supabase
        .from('study_jam_availability')
        .upsert(
            { student_id: studentId, course_code, role, semester_id },
            { onConflict: 'student_id, course_code, semester_id' }
        );
    if (error) {
        console.error('[studyJams] registerAvailability error', error);
        return false;
    }
    return true;
}

export async function insertTutoringMatch(
    tutor_student_id: string,
    tutee_student_id: string,
    course_code: string,
    semester_id: string,
): Promise<void> {
    const { error } = await supabase
        .from('tutoring_matches')
        .insert({ tutor_student_id, tutee_student_id, course_code, semester_id });
    if (error) {
        console.error('[studyJams] insertTutoringMatch error', error);
    }
}

export async function fetchMyTutoringMatch(
    studentId: string,
    _semester_id?: string,
): Promise<{ tutor_student_id: string; tutee_student_id: string; course_code: string } | null> {
    const { data, error } = await supabase
        .from('tutoring_matches')
        .select('tutor_student_id, tutee_student_id, course_code')
        .or(`tutor_student_id.eq.${studentId},tutee_student_id.eq.${studentId}`)
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('[studyJams] fetchMyTutoringMatch error', error);
        return null;
    }
    return data as { tutor_student_id: string; tutee_student_id: string; course_code: string } | null;
}

export async function fetchMyAvailability(studentId: string): Promise<{ course_code: string; role: 'tutor' | 'tutee' }[]> {
    const { data, error } = await supabase
        .from('study_jam_availability')
        .select('course_code, role')
        .eq('student_id', studentId);
    if (error) {
        console.error('[studyJams] fetchMyAvailability error', error);
        return [];
    }
    return data as { course_code: string; role: 'tutor' | 'tutee' }[] ?? [];
}

export async function deleteAvailability(studentId: string, course_code: string): Promise<void> {
    await supabase.from('study_jam_availability').delete().eq('student_id', studentId).eq('course_code', course_code);
}

export async function dismissStudyJam(studentId: string, courseCode: string, semesterId: string): Promise<boolean> {
    const { error } = await supabase
        .from('study_jam_dismissals')
        .upsert(
            { student_id: studentId, course_code: courseCode, semester_id: semesterId },
            { onConflict: 'student_id, course_code, semester_id' }
        );
    if (error) {
        console.error('[studyJams] dismissStudyJam error', error);
        return false;
    }
    return true;
}

export async function fetchMyDismissals(studentId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('study_jam_dismissals')
        .select('course_code')
        .eq('student_id', studentId);
    if (error) {
        console.error('[studyJams] fetchMyDismissals error', error);
        return [];
    }
    return (data as { course_code: string }[] ?? []).map(r => r.course_code);
}
