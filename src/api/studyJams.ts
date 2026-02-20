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
    studium: string,
    course_code: string,
    role: 'tutor' | 'tutee',
    semester_id: string,
): Promise<string | null> {
    const { data, error } = await supabase
        .from('study_jam_availability')
        .insert({ studium, course_code, role, semester_id })
        .select('id')
        .single();
    if (error) {
        console.error('[studyJams] registerAvailability error', error);
        return null;
    }
    return (data as { id: string } | null)?.id ?? null;
}

export async function insertTutoringMatch(
    tutor_studium: string,
    tutee_studium: string,
    course_code: string,
    semester_id: string,
): Promise<void> {
    const { error } = await supabase
        .from('tutoring_matches')
        .insert({ tutor_studium, tutee_studium, course_code, semester_id });
    if (error) {
        console.error('[studyJams] insertTutoringMatch error', error);
    }
}

export async function fetchMyTutoringMatch(
    studium: string,
    semester_id: string,
): Promise<{ tutor_studium: string; tutee_studium: string; course_code: string } | null> {
    const { data, error } = await supabase
        .from('tutoring_matches')
        .select('tutor_studium, tutee_studium, course_code')
        .eq('semester_id', semester_id)
        .or(`tutor_studium.eq.${studium},tutee_studium.eq.${studium}`)
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('[studyJams] fetchMyTutoringMatch error', error);
        return null;
    }
    return data as { tutor_studium: string; tutee_studium: string; course_code: string } | null;
}

export async function deleteAvailability(id: string): Promise<void> {
    await supabase.from('study_jam_availability').delete().eq('id', id);
}
