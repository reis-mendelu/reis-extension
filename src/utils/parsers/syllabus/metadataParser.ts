export function parseCourseMetadata(doc: Document) {
    const info: any = { credits: null, garant: null, teachers: [], status: null };
    doc.querySelectorAll('table tbody tr').forEach(r => {
        const c = r.querySelectorAll('td'); if (c.length < 2) return;
        const l = c[0].textContent || '', v = c[1];
        if (l.includes('Způsob ukončení')) info.credits = v.querySelector('b')?.textContent?.trim() || null;
        if (l.includes('Garant předmětu')) info.garant = v.querySelector('a')?.textContent?.trim() || null;
        if (l.includes('Typ předmětu')) info.status = v.textContent?.trim() || null;
        if (l.includes('Vyučující')) v.querySelectorAll('a').forEach(a => {
            const role = a.parentNode?.textContent?.match(/\(([^)]+)\)/);
            info.teachers.push({ name: a.textContent?.trim() || '', roles: role ? role[1] : '' });
        });
    });
    return info;
}
