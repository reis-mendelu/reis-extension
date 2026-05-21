import { fetchWithAuth, BASE_URL } from './client';
import { logError } from '../utils/reportError';

const PROFILE_URL = `${BASE_URL}/auth/lide/clovek.pl`;

export interface PersonProfile {
    personId: number;
    name: string;
    universityEmail: string | null;
    privateEmail: string | null;
    programmeCode: string | null;
    programmeName: string | null;
    studyTypeSentence: string | null;
    yearSemesterSentence: string | null;
}

function deobfuscate(email: string | null | undefined): string | null {
    if (!email) return null;
    return email.replace(/\s*\[at\]\s*/g, '@').trim() || null;
}

function findMatchInTds(doc: Document, marker: RegExp): string | null {
    const tds = Array.from(doc.querySelectorAll('td.odsazena'));
    for (const td of tds) {
        const text = (td.textContent ?? '').replace(/\s+/g, ' ').trim();
        const m = text.match(marker);
        if (m) return m[0].trim();
    }
    return null;
}

export function parsePersonProfile(html: string, personId: number): PersonProfile | null {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const nameEl = doc.querySelector('td.odsazena b font[size="+1"]');
    const name = nameEl?.textContent?.trim() ?? '';
    if (!name) return null;

    const univAnchor = doc.querySelector<HTMLAnchorElement>(
        `a[href*="nova_zprava.pl?uzivatel=${personId}"]`,
    );
    const universityEmail = deobfuscate(univAnchor?.textContent);

    let privateEmail: string | null = null;
    const mailtoAnchors = Array.from(
        doc.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]'),
    );
    if (mailtoAnchors.length > 0) {
        const href = mailtoAnchors[0].getAttribute('href') ?? '';
        privateEmail = href.replace(/^mailto:/, '').trim() || null;
    }

    let programmeCode: string | null = null;
    let programmeName: string | null = null;
    const boldTds = Array.from(doc.querySelectorAll('td.odsazena b'));
    for (const b of boldTds) {
        const text = (b.textContent ?? '').replace(/ /g, ' ').trim();
        const m = text.match(/^([A-Z]\d{4}[A-Z]\d{6})\s+(.+)$/);
        if (m) {
            programmeCode = m[1];
            programmeName = m[2].trim();
            break;
        }
    }

    const studyTypeSentence = findMatchInTds(
        doc,
        /(Bakalářský|Magisterský|Navazující|Doktorský)[^,]*,\s*(prezenční|kombinovaná)\s*forma/i,
    );

    const yearSemesterSentence = findMatchInTds(
        doc,
        /\d+\.\s*ročník\s*\/\s*\d+\.\s*semestr\s*studia/i,
    );

    return {
        personId,
        name,
        universityEmail,
        privateEmail,
        programmeCode,
        programmeName,
        studyTypeSentence,
        yearSemesterSentence,
    };
}

export async function fetchPersonProfile(
    personId: number,
): Promise<PersonProfile | null> {
    const url = `${PROFILE_URL}?id=${personId};lang=cz`;
    try {
        const response = await fetchWithAuth(url);
        const html = await response.text();
        const result = parsePersonProfile(html, personId);
        if (!result) {
            logError(
                'Parser.parsePersonProfile',
                new Error('clovek.pl returned no name'),
                { personId },
            );
        }
        return result;
    } catch (e) {
        logError('Api.fetchPersonProfile', e, { personId });
        throw e;
    }
}
