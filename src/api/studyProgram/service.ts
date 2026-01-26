import { fetchWithAuth } from '../client';
import { getUserParams } from '../../utils/userParams';
import { scrapeProgramsAndSpecializations, scrapeStudyFormLinks, scrapeStudyPlanRobust } from './scrapers';
import type { StudyProgramData } from './types';

export async function fetchStudyProgram(): Promise<StudyProgramData | null> {
    try {
        const up = await getUserParams();
        if (!up?.facultyId || !up?.obdobi) return null;

        const res1 = await fetchWithAuth(`https://is.mendelu.cz/auth/katalog/plany.pl?fakulta=${up.facultyId}&poc_obdobi=${up.obdobi}&typ_studia=1&lang=cz`);
        const { programs, specializations } = scrapeProgramsAndSpecializations(await res1.text());

        let selP = programs[0];
        if (up.studyProgram) {
            selP = programs.find((p: any) => p.Code === up.studyProgram || p.Name === up.studyProgram) ||
                   (up.studyProgram.includes('-') && programs.find((p: any) => p.Name.startsWith(up.studyProgram!.split('-').slice(0, 2).join('-')))) ||
                   programs.find((p: any) => p.Name.includes(up.studyProgram!) || up.studyProgram!.includes(p.Code)) || programs[0];
        }
        if (!selP) return null;

        const res2 = await fetchWithAuth(selP.Link);
        const text2 = await res2.text();
        const forms = scrapeStudyFormLinks(text2);
        let selF = forms.find((f: any) => f.Form.toLowerCase().includes(up.studyForm?.toLowerCase() || "prezenční")) || forms[0];

        if (!selF) {
            const fb = scrapeStudyPlanRobust(text2);
            return fb.length ? { programs, specializations, finalTable: fb, lastUpdated: Date.now() } : null;
        }

        const res3 = await fetchWithAuth(selF.Link);
        return { programs, specializations, finalTable: scrapeStudyPlanRobust(await res3.text()), lastUpdated: Date.now() };
    } catch (e) { console.error(e); return null; }
}
