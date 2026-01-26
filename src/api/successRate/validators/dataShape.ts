export function validateDataShape(data: any): any {
    if (!data || typeof data !== 'object') return { status: 'invalid', message: 'Data is null or not an object' };
    if (!data.courseCode || typeof data.courseCode !== 'string') return { status: 'invalid', message: 'Missing or invalid courseCode' };
    if (!Array.isArray(data.stats)) return { status: 'invalid', message: 'Missing stats array' };
    if (data.stats.length === 0) return { status: 'invalid', message: 'Empty stats array' };
    const first = data.stats[0];
    if (!first.semesterName || !first.year) return { status: 'invalid', message: 'First stat missing semesterName or year' };
    for (const s of data.stats) {
        const total = (s.totalPass || 0) + (s.totalFail || 0);
        if (total === 0 && !s.terms?.length) return { status: 'invalid', message: `Zero student count in ${s.semesterName}` };
        if (total > 5000) return { status: 'invalid', message: `Unrealistically high student count (${total}) in ${s.semesterName}` };
        for (const t of s.terms || []) {
            const sum = Object.values(t.grades || {}).reduce((a: any, b: any) => a + b, 0) as number;
            if (sum !== (t.pass + t.fail)) return { status: 'invalid', message: `Grade sum mismatch in ${s.semesterName}: ${sum} != ${t.pass + t.fail}` };
        }
    }
    return { status: 'ok', message: `✅ Valid: ${data.stats.length} semesters` };
}
