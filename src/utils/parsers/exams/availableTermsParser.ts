import type { ScrapedExamSubject, ScrapedExamSection } from './types';

export function parseAvailableTerms(doc: Document, getOrCreateSubject: (c: string, n: string) => ScrapedExamSubject, getOrCreateSection: (s: ScrapedExamSubject, n: string) => ScrapedExamSection) {
    const table2 = doc.querySelector('#table_2');
    if (!table2) return;

    table2.querySelectorAll('tbody tr').forEach((row, rowIndex) => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 8) return;

        let dateIndex = -1;
        for (let i = 0; i < cols.length; i++) {
            if (cols[i].textContent?.match(/\d{2}\.\d{2}\.\d{4}/)) {
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
        const [datePart, timePart] = dateStr.split(' ');
        const [occupied, total] = capacityStr.split('/').map(Number);
        const isFull = occupied >= total;

        const termId = row.querySelector('a[href*="prihlasit_ihned=1"]')?.getAttribute('href')?.match(/termin=(\d+)/)?.[1] ||
                       row.querySelector('a[href*="terminy_info.pl"]')?.getAttribute('href')?.match(/termin=(\d+)/)?.[1] ||
                       Math.random().toString(36).substr(2, 9);

        let registrationStart: string | undefined, registrationEnd: string | undefined;
        for (let i = 0; i < cols.length; i++) {
            if (cols[i].innerHTML.includes('<br>')) {
                const parts = cols[i].innerHTML.split(/<br\s*\/?>/i).map(p => p.replace(/<[^>]*>/g, '').trim());
                if (parts[0] !== '--' && parts[0].match(/\d{2}\.\d{2}\.\d{4}/)) registrationStart = parts[0];
                if (parts[1] !== '--' && parts[1].match(/\d{2}\.\d{2}\.\d{4}/)) registrationEnd = parts[1];
                break;
            }
        }

        let attemptType: any;
        for (let i = 0; i < cols.length; i++) {
            const text = (cols[i].innerHTML + (cols[i].querySelector('img')?.getAttribute('alt') || '') + (cols[i].querySelector('img')?.getAttribute('title') || '')).toLowerCase();
            if (text.includes('opravný 3')) attemptType = 'retake3';
            else if (text.includes('opravný 2')) attemptType = 'retake2';
            else if (text.includes('opravný 1') || text.includes('opravný')) attemptType = 'retake1';
            else if (text.includes('řádný')) attemptType = 'regular';
            if (attemptType) break;
        }

        const subject = getOrCreateSubject(code, name);
        const section = getOrCreateSection(subject, sectionName);
        section.terms.push({ id: termId, date: datePart, time: timePart, capacity: capacityStr, full: isFull, room, teacher, teacherId, registrationStart, registrationEnd, attemptType, canRegisterNow: !!row.querySelector('a[href*="prihlasit_ihned=1"]') && !isFull });
    });
}
