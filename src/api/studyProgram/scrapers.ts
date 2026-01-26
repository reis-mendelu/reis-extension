import type { StudyProgramCourse } from './types';

export function scrapeProgramsAndSpecializations(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const origin = "https://is.mendelu.cz";

    const get = (hText: string, label: string) => {
        const h = Array.from(doc.querySelectorAll('b, strong, h1, h2')).find(el => el.textContent?.includes(hText));
        if (!h) return [];
        let s = h.nextElementSibling, t = null;
        for(let i=0; i<5 && s; i++) { if (s.tagName === 'TABLE') { t = s; break; }; if (s.querySelector('table')) { t = s.querySelector('table'); break; }; s = s.nextElementSibling; }
        if (!t) return [];
        return Array.from(t.querySelectorAll('tbody tr')).map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return null;
            const eye = row.querySelector('img[sysid="prohlizeni-info"]')?.closest('a')?.getAttribute('href');
            return { Code: cells[1].textContent?.trim() || "", Name: cells[2].textContent?.trim() || "", Link: eye ? (eye.startsWith('http') ? eye : origin + (eye.startsWith('/') ? eye : "/auth/katalog/" + eye)) : "N/A", Type: label };
        }).filter(r => r !== null);
    };
    return { programs: get("Výběr studijního programu", "Program"), specializations: get("Výběr specializace", "Specialization") };
}

export function scrapeStudyFormLinks(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const h = Array.from(doc.querySelectorAll('b, strong, h1')).find(el => el.textContent?.includes("Výběr formy studia"));
    if (!h) return [];
    let t = null, s = h.nextElementSibling;
    for(let i=0; i<5 && s; i++) { if (s.tagName === 'TABLE') { t = s; break; }; s = s.nextElementSibling; }
    if (!t) return [];
    const idx = Array.from(t.querySelectorAll('th')).findIndex(th => th.textContent?.includes("Prohlížet"));
    if (idx === -1) return [];
    return Array.from(t.querySelectorAll('tbody tr')).map(row => {
        const c = row.querySelectorAll('td');
        const a = c[idx]?.querySelector('a')?.getAttribute('href');
        return c.length > idx ? { Form: c[0].textContent?.trim() || "", Link: a ? (a.startsWith('http') ? a : "https://is.mendelu.cz" + (a.startsWith('/') ? a : "/auth/katalog/" + a)) : "N/A" } : null;
    }).filter(r => r !== null);
}

export function scrapeStudyPlanRobust(html: string): StudyProgramCourse[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anc = Array.from(doc.querySelectorAll('td, th')).find(el => el.textContent?.includes("Název předmětu"));
    if (!anc || !(anc instanceof HTMLTableCellElement)) return [];
    const t = anc.closest('table'); if (!t) return [];
    const nIdx = anc.cellIndex, cIdx = nIdx - 1, compIdx = nIdx + 1, credIdx = nIdx + 2;
    let sem = "Unknown Semester", cat = "Uncategorized", plan: StudyProgramCourse[] = [];
    Array.from(t.querySelectorAll('tbody tr')).forEach(row => {
        const txt = row.textContent?.trim() || "", cells = row.querySelectorAll('td');
        if (row.querySelector('font[size="+1"]') || txt.match(/^\d+\.\s*semestr/i)) { sem = txt.replace(/\s+/g, " "); return; }
        if (txt.includes("Skupina předmětů")) { cat = txt.replace(/\s+/g, " "); return; }
        if (cells.length > credIdx && cells[cIdx].textContent?.trim() !== "Kód" && cells[cIdx].textContent?.trim() !== "") {
            const a = cells[nIdx].querySelector('a') || cells[cIdx].querySelector('a');
            const h = a?.getAttribute('href');
            plan.push({ Semester: sem, Category: cat, Code: cells[cIdx].textContent?.trim() || "", Name: cells[nIdx].textContent?.trim() || "", Completion: cells[compIdx].textContent?.trim() || "", Credits: cells[credIdx].textContent?.trim() || "", Link: h ? (h.startsWith('..') ? "https://is.mendelu.cz/auth" + h.substring(2) : h.startsWith('/') ? "https://is.mendelu.cz" + h : h.startsWith('http') ? h : "https://is.mendelu.cz/auth/katalog/" + h) : "N/A" });
        }
    });
    return plan;
}
