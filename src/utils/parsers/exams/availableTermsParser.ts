import type { ScrapedExamSubject, ScrapedExamSection } from './types';
import { normalizeDateString } from './utils';
import { reportError } from '../../reportError';

export function parseAvailableTerms(doc: Document, getOrCreateSubject: (c: string, n: string) => ScrapedExamSubject, getOrCreateSection: (s: ScrapedExamSubject, n: string) => ScrapedExamSection, lang: string = 'cz') {
    const isEn = lang === 'en';
    const table2 = doc.querySelector('#table_2');
    if (!table2) return;

    table2.querySelectorAll('tbody tr').forEach((row) => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 8) return;

        let dateIndex = -1;
        for (let i = 0; i < cols.length; i++) {
            if (cols[i].textContent?.match(/\d{2}[./]\d{2}[./]\d{4}/)) {
                dateIndex = i;
                break;
            }
        }
        if (dateIndex === -1) return;

        const code = cols[2].textContent?.trim() || '';
        const name = cols[3].textContent?.trim() || '';
        const dateStr = cols[dateIndex].textContent?.trim() || '';
        const room = cols[dateIndex + 1]?.textContent?.trim() || '';
        const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
        const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';
        const capacityStr = cols[dateIndex + 4]?.textContent?.trim() || '';

        const teacherId = cols[dateIndex + 3]?.querySelector('a[href*="clovek.pl"]')?.getAttribute('href')?.match(/id=(\d+)/)?.[1] || '';
        const sectionName = sectionNameRaw.split('(')[0].trim();
        const normalizedDateStr = normalizeDateString(dateStr, isEn);
        const [datePart, timePart] = normalizedDateStr.split(' ');
        const [occupied, total] = capacityStr.split('/').map(Number);
        if (capacityStr && (Number.isNaN(occupied) || Number.isNaN(total))) {
            reportError('Parser.parseAvailableTerms', new Error(`capacity unparseable: ${JSON.stringify(capacityStr)}`), { code, name });
        }
        const isFull = Number.isFinite(occupied) && Number.isFinite(total) && occupied >= total;

        const termId = row.querySelector('a[href*="prihlasit_ihned=1"]')?.getAttribute('href')?.match(/termin=(\d+)/)?.[1] ||
                       row.querySelector('a[href*="terminy_info.pl"]')?.getAttribute('href')?.match(/termin=(\d+)/)?.[1] ||
                       Math.random().toString(36).substr(2, 9);

        let registrationStart: string | undefined, registrationEnd: string | undefined, deregistrationDeadline: string | undefined;
        for (let i = 0; i < cols.length; i++) {
            const parts = cols[i].innerHTML.split(/<br\s*\/?>/i).map(p => p.replace(/<[^>]*>/g, '').trim());
            if (parts.length >= 3) {
                if (parts[0] !== '--' && parts[0].match(/\d{2}[./]\d{2}[./]\d{4}/)) registrationStart = normalizeDateString(parts[0], isEn);
                if (parts[1] !== '--' && parts[1].match(/\d{2}[./]\d{2}[./]\d{4}/)) registrationEnd = normalizeDateString(parts[1], isEn);
                if (parts[2] !== '--' && parts[2].match(/\d{2}[./]\d{2}[./]\d{4}/)) deregistrationDeadline = normalizeDateString(parts[2], isEn);
                break;
            }
        }

        let attemptType: 'regular' | 'retake1' | 'retake2' | 'retake3' | undefined;
        for (let i = 0; i < cols.length; i++) {
            const text = (cols[i].innerHTML + (cols[i].querySelector('img')?.getAttribute('alt') || '') + (cols[i].querySelector('img')?.getAttribute('title') || '')).toLowerCase();
            if (text.includes('opravný 3') || text.includes('3rd resit')) attemptType = 'retake3';
            else if (text.includes('opravný 2') || text.includes('2nd resit')) attemptType = 'retake2';
            else if (text.includes('opravný 1') || text.includes('opravný') || text.includes('resit')) attemptType = 'retake1';
            else if (text.includes('řádný') || text.includes('first sit')) attemptType = 'regular';
            if (attemptType) break;
        }

        const subject = getOrCreateSubject(code, name);
        const section = getOrCreateSection(subject, sectionName);
        section.terms.push({ 
            id: termId, 
            date: datePart, 
            time: timePart, 
            capacity: capacityStr, 
            full: isFull, 
            room, 
            teacher, 
            teacherId, 
            registrationStart,
            registrationEnd,
            deregistrationDeadline,
            attemptType, 
            canRegisterNow: !!row.querySelector('a[href*="prihlasit_ihned=1"]') && !isFull,
            roomCs: isEn ? undefined : room,
            roomEn: isEn ? room : undefined
        });
    });
}
