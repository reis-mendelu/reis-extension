import type { ScrapedExamSubject, ScrapedExamSection } from './types';
import { normalizeDateString } from './utils';

export function parseRegisteredTerms(doc: Document, getOrCreateSubject: (c: string, n: string) => ScrapedExamSubject, getOrCreateSection: (s: ScrapedExamSubject, n: string) => ScrapedExamSection, lang: string = 'cz') {
    const isEn = lang === 'en';
    const table1 = doc.querySelector('#table_1');
    if (!table1) return;

    table1.querySelectorAll('tbody tr').forEach((row) => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 6) return;

        let dateIndex = -1;
        for (let i = 0; i < cols.length; i++) {
            if (cols[i].textContent?.match(/\d{2}[\./]\d{2}[\./]\d{4}/)) {
                dateIndex = i;
                break;
            }
        }
        if (dateIndex === -1) return;

        const code = cols[1].textContent?.trim() || '';
        const name = cols[2].textContent?.trim() || '';
        const dateStr = cols[dateIndex].textContent?.trim() || '';
        const room = cols[dateIndex + 1]?.textContent?.trim() || '';
        const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
        const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';

        const teacherLink = cols[dateIndex + 3]?.querySelector('a[href*="clovek.pl"]');
        const teacherId = teacherLink?.getAttribute('href')?.match(/id=(\d+)/)?.[1] || '';
        const sectionName = sectionNameRaw.split('(')[0].trim();
        const normalizedDateStr = normalizeDateString(dateStr, isEn);
        const [date, time] = normalizedDateStr.split(' ');

        const termId = row.querySelector('a[href*="odhlasit_ihned=1"]')?.getAttribute('href')?.match(/termin=(\d+)/)?.[1] || '';

        let deregistrationDeadline: string | undefined;
        for (let i = 0; i < cols.length; i++) {
            const parts = cols[i].innerHTML.split(/<br\s*\/?>/i);
            if (parts.length >= 3) {
                const deadlineRaw = parts[2].replace(/<[^>]*>/g, '').trim();
                if (deadlineRaw !== '--' && deadlineRaw.match(/\d{2}[\./]\d{2}[\./]\d{4}/)) {
                    deregistrationDeadline = normalizeDateString(deadlineRaw, isEn);
                    break;
                }
            }
        }

        const subject = getOrCreateSubject(code, name);
        const section = getOrCreateSection(subject, sectionName);
        section.status = 'registered';
        section.registeredTerm = { 
            id: termId, 
            date, 
            time, 
            room, 
            teacher, 
            teacherId, 
            deregistrationDeadline,
            roomCs: isEn ? undefined : room,
            roomEn: isEn ? room : undefined
        };
    });
}
