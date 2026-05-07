import type { ScrapedExamSubject, ScrapedExamSection } from './types';
import { normalizeDateString } from './utils';
import { logError } from '../../reportError';

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
        // Strip trailing "(n)" waitlist suffix before parsing: "0/12(8)" → occupied=0, total=12
        const [occupied, total] = capacityStr.split('/').map(s => Number(s.replace(/\(\d+\)$/, '')));
        if (capacityStr && (Number.isNaN(occupied) || Number.isNaN(total))) {
            logError('Parser.parseAvailableTerms', new Error(`capacity unparseable: ${JSON.stringify(capacityStr)}`), { code, name });
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

        // A single term can serve multiple attempt types (e.g. both řádný and 1. opravný).
        // IS Mendelu uses sysid="termin-radny" / "termin-opravny-1" etc. on <img> tags in the Typ termínu cell.
        const attemptTypes: ('regular' | 'retake1' | 'retake2' | 'retake3')[] = [];
        const sysidMap: Record<string, 'regular' | 'retake1' | 'retake2' | 'retake3'> = {
            'termin-radny': 'regular',
            'termin-opravny-1': 'retake1',
            'termin-opravny-2': 'retake2',
            'termin-opravny-3': 'retake3',
        };
        for (let i = 0; i < cols.length; i++) {
            cols[i].querySelectorAll('img[sysid]').forEach(img => {
                const mapped = sysidMap[img.getAttribute('sysid') || ''];
                if (mapped && !attemptTypes.includes(mapped)) attemptTypes.push(mapped);
            });
            if (attemptTypes.length > 0) break;
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
            attemptTypes: attemptTypes.length > 0 ? attemptTypes : undefined,
            canRegisterNow: !!row.querySelector('a[href*="prihlasit_ihned=1"]') && !isFull,
            roomCs: isEn ? undefined : room,
            roomEn: isEn ? room : undefined
        });
    });
}
