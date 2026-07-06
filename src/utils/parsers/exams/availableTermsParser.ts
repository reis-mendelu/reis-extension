import type { ScrapedExamSubject, ScrapedExamSection } from './types';
import { normalizeDateString } from './utils';
import { logError } from '../../reportError';

const IS_BASE = 'https://is.mendelu.cz';

function absoluteIsUrl(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${IS_BASE}${href}`;
  // Operace-cell anchors (Podrobnosti) emit bare-relative hrefs like
  // "terminy_info.pl?termin=…" — the source page lives at /auth/student/,
  // which is where the browser would resolve them. Anchor explicitly there
  // rather than at the IS root (which 404s).
  return `${IS_BASE}/auth/student/${href}`;
}

function findActionHref(row: Element, sysid: string): string | undefined {
  // Iterate all img[sysid] anchors in the row and match by attribute value.
  // Mirrors the attempt-type icon iteration pattern below (lines ~70) which
  // is known to work under happy-dom; querySelector with attribute-value
  // selectors plus .closest() proved unreliable.
  const anchors = row.querySelectorAll('a');
  for (let i = 0; i < anchors.length; i++) {
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const img = anchors[i].querySelector('img[sysid]');
    if (img && img.getAttribute('sysid') === sysid) {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      return absoluteIsUrl(anchors[i].getAttribute('href'));
    }
  }
  return undefined;
}

// IS Mendelu swaps the watchdog icon (and its sysid) depending on state:
// activation uses one img, deactivation uses another (with X over the dog).
// Match by the href's `aktivace=` parameter instead so we catch both states.
function findWatchdogHref(row: Element): string | undefined {
  const anchor = row.querySelector('a[href*="aktivace="]');
  return absoluteIsUrl(anchor?.getAttribute('href') ?? undefined);
}

export function parseAvailableTerms(
  doc: Document,
  getOrCreateSubject: (c: string, n: string) => ScrapedExamSubject,
  getOrCreateSection: (s: ScrapedExamSubject, n: string) => ScrapedExamSection,
  lang: string = 'cz'
) {
  const isEn = lang === 'en';
  const table2 = doc.querySelector('#table_2');
  if (!table2) return;

  table2.querySelectorAll('tbody tr').forEach((row) => {
    const cols = row.querySelectorAll('td');
    if (cols.length < 8) return;

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
    const code = cols[2].textContent?.trim() || '';
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const name = cols[3].textContent?.trim() || '';
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const dateStr = cols[dateIndex].textContent?.trim() || '';
    const room = cols[dateIndex + 1]?.textContent?.trim() || '';
    const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
    const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';
    const capacityStr = cols[dateIndex + 4]?.textContent?.trim() || '';

    const teacherId =
      cols[dateIndex + 3]
        ?.querySelector('a[href*="clovek.pl"]')
        ?.getAttribute('href')
        ?.match(/id=(\d+)/)?.[1] || '';
    // "Druh (forma)" cell looks like "zkouška (písemná a ústní)" — split into
    // section name + form. Some terms have no form ("zkouška") and emit just the name.
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const sectionName = sectionNameRaw.split('(')[0].trim();
    const formMatch = sectionNameRaw.match(/\(([^)]+)\)/);
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const sectionForm = formMatch?.[1].trim() || undefined;
    const normalizedDateStr = normalizeDateString(dateStr, isEn);
    const [datePart, timePart] = normalizedDateStr.split(' ');
    // Strip trailing "(n)" waitlist suffix before parsing: "0/12(8)" → occupied=0, total=12
    const [occupied, total] = capacityStr.split('/').map((s) => Number(s.replace(/\(\d+\)$/, '')));
    if (capacityStr && (Number.isNaN(occupied) || Number.isNaN(total))) {
      logError(
        'Parser.parseAvailableTerms',
        new Error(`capacity unparseable: ${JSON.stringify(capacityStr)}`),
        { code, name }
      );
    }
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const isFull = Number.isFinite(occupied) && Number.isFinite(total) && occupied >= total;

    const termId =
      row
        .querySelector('a[href*="prihlasit_ihned=1"]')
        ?.getAttribute('href')
        ?.match(/termin=(\d+)/)?.[1] ||
      row
        .querySelector('a[href*="terminy_info.pl"]')
        ?.getAttribute('href')
        ?.match(/termin=(\d+)/)?.[1];
    if (!termId) {
      logError('Parser.parseAvailableTerms', new Error('row has no termin ID'), {
        code,
        name,
        dateStr,
      });
      return;
    }

    let registrationStart: string | undefined,
      registrationEnd: string | undefined,
      deregistrationDeadline: string | undefined;
    for (let i = 0; i < cols.length; i++) {
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      const parts = cols[i].innerHTML
        .split(/<br\s*\/?>/i)
        .map((p) => p.replace(/<[^>]*>/g, '').trim());
      if (parts.length >= 3) {
        // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
        if (parts[0] !== '--' && parts[0].match(/\d{2}[./]\d{2}[./]\d{4}/))
          // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
          registrationStart = normalizeDateString(parts[0], isEn);
        // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
        if (parts[1] !== '--' && parts[1].match(/\d{2}[./]\d{2}[./]\d{4}/))
          // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
          registrationEnd = normalizeDateString(parts[1], isEn);
        // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
        if (parts[2] !== '--' && parts[2].match(/\d{2}[./]\d{2}[./]\d{4}/))
          // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
          deregistrationDeadline = normalizeDateString(parts[2], isEn);
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
      // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
      cols[i].querySelectorAll('img[sysid]').forEach((img) => {
        const mapped = sysidMap[img.getAttribute('sysid') || ''];
        if (mapped && !attemptTypes.includes(mapped)) attemptTypes.push(mapped);
      });
      if (attemptTypes.length > 0) break;
    }

    // IS Mendelu built-in action links from the Operace cell.
    // Wrapped in try/catch so a DOM oddity here can never break the whole term parse.
    let watchdogUrl: string | undefined,
      blockReasonUrl: string | undefined,
      detailUrl: string | undefined;
    try {
      watchdogUrl = findWatchdogHref(row);
      blockReasonUrl = findActionHref(row, 'studevid-nesplnene-povinnosti');
      detailUrl = findActionHref(row, 'prohlizeni-info');
    } catch (e) {
      logError('Parser.parseAvailableTerms.actions', e, { code, name, termId });
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
      roomEn: isEn ? room : undefined,
      sectionForm,
      sectionFormCs: isEn ? undefined : sectionForm,
      sectionFormEn: isEn ? sectionForm : undefined,
      watchdogUrl,
      blockReasonUrl,
      detailUrl,
    });
  });
}
