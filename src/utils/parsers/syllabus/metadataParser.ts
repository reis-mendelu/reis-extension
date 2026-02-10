import type { CourseMetadata } from "../../../schemas/syllabusSchema";

export function parseCourseMetadata(doc: Document, lang: string = 'cs'): CourseMetadata {
    const isValidName = (name: string | null) => {
        if (!name) return false;
        const n = name.toLowerCase().trim();
        // Match placeholders like -- text -- or — text —
        return !n.match(/^[-–—].*[-–—]$/) && 
               !n.includes('not defined') && 
               !n.includes('nebyla zadána');
    };

    const info: CourseMetadata = { 
        courseName: null,      // Deprecated: for backward compatibility
        courseNameCs: null,    // Czech name
        courseNameEn: null,    // English name
        credits: null, 
        garant: null, 
        teachers: [], 
        status: null 
    };

    doc.querySelectorAll('table tbody tr').forEach(r => {
        const c = r.querySelectorAll('td'); if (c.length < 2) return;
        const l = (c[0].textContent || '').toLowerCase().trim().replace(/:$/, ''), v = c[1];
        const v_txt = v.textContent?.trim() || null;
        
        // Extract BOTH Czech and English names
        if ((l === 'název předmětu' || l === 'course title in czech') && isValidName(v_txt)) {
            info.courseNameCs = v_txt;
        } else if ((l === 'název předmětu anglicky' || l === 'course title in english' || l === 'course title') && isValidName(v_txt)) {
            info.courseNameEn = v_txt;
        }

        // Match Czech and English labels strictly
        if (l === 'způsob ukončení' || l === 'completion' || l === 'mode of completion and number of credits') {
             // Prioritize bold text (e.g. "Exam") then full text
             const bold = v.querySelector('b')?.textContent?.trim();
             info.credits = bold || v_txt;
        }
        if (l === 'garant předmětu' || l === 'guarantor' || l === 'course supervisor') {
             info.garant = v.querySelector('a')?.textContent?.trim() || v_txt;
        }
        if (l === 'typ předmětu' || l === 'course type') {
             info.status = v_txt;
        }
        if (l === 'vyučující' || l === 'instructors' || l === 'teachers') {
            v.querySelectorAll('a').forEach(a => {
                const role = a.parentNode?.textContent?.match(/\(([^)]+)\)/);
                info.teachers.push({ name: a.textContent?.trim() || '', roles: role ? role[1] : '' });
            });
        }
    });

    // Set deprecated courseName with full fallback path
    info.courseName = (lang === 'en' ? info.courseNameEn : info.courseNameCs) || info.courseNameCs || info.courseNameEn;

    return info;
}

