import { checkCDNAvailability, CDN_BASE_URL } from './successRate/validators/cdnCheck';
import { validateDataShape } from './successRate/validators/dataShape';
import { parseSemesterName } from './successRate/validators/semesterParse';

export * from './successRate/validators/cdnCheck';
export * from './successRate/validators/dataShape';
export * from './successRate/validators/semesterParse';

export async function auditSubject(code: string) {
    const cdn = await checkCDNAvailability(code);
    if (cdn.status !== 'ok') return { cdnStatus: cdn };
    try {
        const data = await (await fetch(`${CDN_BASE_URL}/subjects/${code}.json`)).json();
        return { cdnStatus: cdn, dataShape: validateDataShape(data), semesters: Array.isArray(data.stats) ? data.stats.map((s: { semesterName: string }) => parseSemesterName(s.semesterName)) : [] };
    } catch (e) { return { cdnStatus: cdn, dataShape: { code, status: 'error', message: `Parse error: ${e}` } }; }
}
