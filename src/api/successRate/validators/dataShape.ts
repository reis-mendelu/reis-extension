export function validateDataShape(data: unknown): { status: 'ok' | 'invalid' | 'error'; message: string } {
    if (!data || typeof data !== 'object') return { status: 'invalid', message: 'Data is null or not an object' };
    const d = data as Record<string, unknown>;
    if (!d.courseCode || typeof d.courseCode !== 'string') return { status: 'invalid', message: 'Missing or invalid courseCode' };
    if (!Array.isArray(d.stats)) return { status: 'invalid', message: 'Missing stats array' };
    if (d.stats.length === 0) return { status: 'invalid', message: 'Empty stats array' };
    const first = d.stats[0] as Record<string, unknown>;
    if (!first.semesterName || !first.year) return { status: 'invalid', message: 'First stat missing semesterName or year' };
    for (const s of d.stats as Record<string, unknown>[]) {
        const total = ((s.totalPass as number) || 0) + ((s.totalFail as number) || 0);
        if (total === 0 && !(s.terms as unknown[])?.length) return { status: 'invalid', message: `Zero student count in ${s.semesterName}` };
        if (total > 5000) return { status: 'invalid', message: `Unrealistically high student count (${total}) in ${s.semesterName}` };
        for (const t of (s.terms || []) as Record<string, unknown>[]) {
            const term = t as Record<string, number>;
            const sum = Object.values((term.grades || {}) as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
            if (sum !== (term.pass + term.fail)) return { status: 'invalid', message: `Grade sum mismatch in ${s.semesterName}: ${sum} != ${term.pass + term.fail}` };
        }
    }
    return { status: 'ok', message: `✅ Valid: ${d.stats.length} semesters` };
}
