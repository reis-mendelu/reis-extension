import type { CourseMetadata } from '../../../schemas/syllabusSchema';

export function parseCourseMetadata(doc: Document, lang: string = 'cz'): CourseMetadata {
  const isValidName = (name: string | null) => {
    if (!name) return false;
    const n = name.toLowerCase().trim();
    // Match placeholders like -- text -- or — text —
    return !n.match(/^[-–—].*[-–—]$/) && !n.includes('not defined') && !n.includes('nebyla zadána');
  };

  const info: CourseMetadata = {
    courseName: null, // Deprecated: for backward compatibility
    courseNameCs: null, // Czech name
    courseNameEn: null, // English name
    credits: null,
    garant: null,
    teachers: [],
    status: null,
  };

  const normalizeLabel = (text: string) => {
    return (text || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/:$/, '');
  };

  // `completion` is never initialised: only an InSIS page sets it, so a MENDELU
  // record keeps exactly the keys it had before.
  let sawCredits = false;
  let sawTeachers = false;
  const insis: { credits: string | null; completion: string | null } & Pick<
    CourseMetadata,
    'teachers'
  > = { credits: null, completion: null, teachers: [] };

  doc.querySelectorAll('table tbody tr').forEach((r) => {
    const c = r.querySelectorAll('td');
    if (c.length < 2) return;
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const l = normalizeLabel(c[0].textContent || '');
    const v = c[1];
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const v_txt = v.textContent?.trim() || null;

    // Extract BOTH Czech and English names
    if (
      (l === 'název předmětu' || l === 'název předmětu česky' || l === 'course title in czech') &&
      isValidName(v_txt)
    ) {
      info.courseNameCs = v_txt;
    } else if (
      (l === 'název předmětu anglicky' ||
        l === 'course title in english' ||
        l === 'course title') &&
      isValidName(v_txt)
    ) {
      info.courseNameEn = v_txt;
    }

    // Match Czech and English labels
    if (
      l === 'způsob ukončení' ||
      l === 'způsob ukončení a počet kreditů' ||
      l === 'completion' ||
      l === 'mode of completion and number of credits'
    ) {
      // Prioritize bold text (e.g. "Exam") then full text
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      const bold = v.querySelector('b')?.textContent?.trim();
      info.credits = bold || v_txt;
      sawCredits = true;
    }
    const extractId = (url: string | null | undefined) => {
      if (!url) return null;
      const match = url.match(/id=(\d+)/);
      return match ? match[1] : null;
    };

    if (l === 'garant předmětu' || l === 'guarantor' || l === 'course supervisor') {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      const anchor = v.querySelector('a');
      info.garant = {
        name: anchor?.textContent?.trim() || v_txt,
        id: extractId(anchor?.getAttribute('href')),
      };
    }
    if (l === 'typ předmětu' || l === 'course type') {
      info.status = v_txt;
    }
    const readTeachers = (into: CourseMetadata['teachers']) => {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      v.querySelectorAll('a').forEach((a) => {
        // Roles are usually in parenthesis immediately following the link
        // IS structure: <a href="...">Name</a> (role), <a href="...">Name</a> (role)
        let roles = '';
        const nextNode = a.nextSibling;
        if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
          const match = nextNode.textContent?.match(/\(([^)]+)\)/);
          // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
          if (match) roles = match[1];
        }

        into.push({
          name: a.textContent?.trim() || '',
          id: extractId(a.getAttribute('href')),
          roles: roles.trim(),
        });
      });
    };

    if (l === 'vyučující' || l === 'instructors' || l === 'teachers') {
      sawTeachers = true;
      readTeachers(info.teachers);
    }

    // InSIS (VŠE) labels, kept apart and applied after the loop only where no
    // MENDELU label matched, so a MENDELU page can never read them.
    if (l === 'počet přidělených ects kreditů' || l === 'number of ects credits allocated') {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      insis.credits = v.querySelector('b')?.textContent?.trim() || v_txt;
    }
    if (l === 'forma ukončení' || l === 'mode of completion') insis.completion = v_txt;
    if (l === 'name of lecturer(s)') readTeachers(insis.teachers);
  });

  if (!sawCredits && insis.credits) info.credits = insis.credits;
  if (insis.completion) info.completion = insis.completion;
  if (!sawTeachers && insis.teachers.length > 0) info.teachers = insis.teachers;

  // Set deprecated courseName with full fallback path
  info.courseName =
    (lang === 'en' ? info.courseNameEn : info.courseNameCs) ||
    info.courseNameCs ||
    info.courseNameEn;

  return info;
}
