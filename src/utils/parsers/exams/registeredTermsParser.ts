import type { ScrapedExamSubject, ScrapedExamSection } from './types';
import { normalizeDateString } from './utils';
import { iconSysids, ATTEMPT_BY_SYSID, type AttemptType } from './attemptIcons';
import { absoluteIsUrl } from './isUrl';

export function parseRegisteredTerms(
  doc: Document,
  getOrCreateSubject: (c: string, n: string) => ScrapedExamSubject,
  getOrCreateSection: (s: ScrapedExamSubject, n: string) => ScrapedExamSection,
  lang: string = 'cz'
) {
  const isEn = lang === 'en';
  const table1 = doc.querySelector('#table_1');
  if (!table1) return;

  table1.querySelectorAll('tbody tr').forEach((row) => {
    const cols = row.querySelectorAll('td');
    if (cols.length < 6) return;

    let dateIndex = -1;
    for (let i = 0; i < cols.length; i++) {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      if (cols[i].textContent?.match(/\d{2}[./]\d{2}[./]\d{4}/)) {
        dateIndex = i;
        break;
      }
    }
    if (dateIndex === -1) return;

    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const code = cols[1].textContent?.trim() || '';
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const name = cols[2].textContent?.trim() || '';
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const dateStr = cols[dateIndex].textContent?.trim() || '';
    const room = cols[dateIndex + 1]?.textContent?.trim() || '';
    const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
    const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';

    const teacherLink = cols[dateIndex + 3]?.querySelector('a[href*="clovek.pl"]');
    const teacherId = teacherLink?.getAttribute('href')?.match(/id=(\d+)/)?.[1] || '';
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const sectionName = sectionNameRaw.split('(')[0].trim();
    // "průběžný test 1 (e-test)" — the bracket is the form, as in table_2.
    const sectionForm = sectionNameRaw.match(/\(([^)]+)\)/)?.[1]?.trim();
    const normalizedDateStr = normalizeDateString(dateStr, isEn);
    const [date, time] = normalizedDateStr.split(' ');

    const termId =
      row
        .querySelector('a[href*="odhlasit_ihned=1"]')
        ?.getAttribute('href')
        ?.match(/termin=(\d+)/)?.[1] ||
      row
        .querySelector('a[href*="terminy_info"]')
        ?.getAttribute('href')
        ?.match(/termin=(\d+)/)?.[1] ||
      '';

    // One cell, three moments: registration from / to, deregistration to.
    let registrationStart: string | undefined,
      registrationEnd: string | undefined,
      deregistrationDeadline: string | undefined;
    for (let i = 0; i < cols.length; i++) {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      const parts = cols[i].innerHTML.split(/<br\s*\/?>/i).map((x) => x.replace(/<[^>]*>/g, '').trim());
      if (parts.length >= 3) {
        const at = (raw: string | undefined) =>
          raw && raw !== '--' && raw.match(/\d{2}[./]\d{2}[./]\d{4}/)
            ? normalizeDateString(raw, isEn)
            : undefined;
        registrationStart = at(parts[0]);
        registrationEnd = at(parts[1]);
        deregistrationDeadline = at(parts[2]);
        if (deregistrationDeadline || registrationEnd) break;
      }
    }

    // The seat count and the attempt type the row also carries — the phone
    // shows both on every term row, this one included.
    // Raw "54/70", the shape this stage carries everywhere — a later step turns
    // it into {occupied,total,raw}.
    const capacityStr = cols[dateIndex + 4]?.textContent?.trim() || '';
    const [occupied = NaN, total = NaN] = capacityStr
      .split('/')
      .map((x) => Number(x.replace(/\(\d+\)$/, '')));
    const isFull = Number.isFinite(occupied) && Number.isFinite(total) && occupied >= total;
    const attemptTypes: AttemptType[] = [];
    for (let i = 0; i < cols.length; i++) {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      iconSysids(cols[i]).forEach((id) => {
        const mapped = ATTEMPT_BY_SYSID[id];
        if (mapped && !attemptTypes.includes(mapped)) attemptTypes.push(mapped);
      });
      if (attemptTypes.length > 0) break;
    }

    const detailUrl = absoluteIsUrl(
      row.querySelector('a[href*="terminy_info"]')?.getAttribute('href')
    );

    const subject = getOrCreateSubject(code, name);
    const section = getOrCreateSection(subject, sectionName);
    section.status = 'registered';
    // The term the student is ON belongs in `terms` as well: the phone's card
    // lists those, so without this their own term was the one row missing from
    // it — every row it showed was a term they were not on, which is why they
    // all read "Přihlášení do" and none read "Odhlášení do".
    if (termId && !section.terms.some((t) => t.id === termId)) {
      section.terms.push({
        id: termId,
        date: date ?? '',
        time: time ?? '',
        capacity: capacityStr || undefined,
        full: isFull,
        room,
        teacher,
        teacherId,
        roomCs: isEn ? undefined : room,
        roomEn: isEn ? room : undefined,
        registrationStart,
        registrationEnd,
        deregistrationDeadline,
        attemptTypes: attemptTypes.length > 0 ? attemptTypes : undefined,
        detailUrl,
        sectionForm,
        sectionFormCs: isEn ? undefined : sectionForm,
        sectionFormEn: isEn ? sectionForm : undefined,
        // Being on it is exactly why IS offers no "register" link here.
        canRegisterNow: false,
      });
    }
    section.registeredTerm = {
      id: termId,
      date,
      time,
      room,
      teacher,
      teacherId,
      deregistrationDeadline,
      roomCs: isEn ? undefined : room,
      roomEn: isEn ? room : undefined,
    };
  });
}
