// --- DATA INTERFACES ---

export interface Person {
    id: string | null;
    name: string;
    link: string;
    details: string; // e.g., "ÚI PEF, OIS OIT CP, ext AF..."
}

export interface Subject {
    code: string | null;
    name: string;
    link: string;
    semesterInfo: string | null; // "ZS 2025/2026"
    faculty: string | null;      // "PEF"
}

export interface SearchDocument {
    title: string;
    link: string;
    description: string | null; // "Základní studijní materiál"
    folder: {
        name: string;
        link: string;
    } | null;
    author: {
        name: string;
        id: string | null;
        link: string;
    } | null;
    date: string | null;
}

export interface GeneralSearchResults {
    people: Person[];
    subjects: Subject[];
    documents: SearchDocument[];
}

// --- PARSING LOGIC ---

const BASE_URL = "https://is.mendelu.cz/auth/";

/**
 * Parses the HTML from any MENDELU global search result page.
 * It intelligently identifies which sections are present and extracts data accordingly.
 *
 * @param htmlString The raw HTML from the server.
 * @returns A structured object containing arrays for each category found.
 */
export function parseSearchResults(htmlString: string): GeneralSearchResults {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    return {
        people: _parsePeopleSection(doc),
        subjects: _parseSubjectsSection(doc),
        documents: _parseDocumentsSection(doc),
    };
}

// --- Private Helper Functions for Parsing Each Section ---

function _findSectionContainer(doc: Document, sectionName: string): Element | null {
    const anchor = doc.querySelector(`a[name="${sectionName}"]`);
    if (!anchor) return null;
    // The content for a section is usually wrapped in a container that follows the anchor.
    // Let's find the header and then find all sibling elements until the next section or a separator.
    let container = document.createElement('div');
    let sibling = anchor.nextElementSibling;
    while(sibling && sibling.tagName.toLowerCase() !== 'hr' && !sibling.querySelector('a[name]')) {
        container.appendChild(sibling.cloneNode(true));
        sibling = sibling.nextElementSibling;
    }
    return container;
}

function _parsePeopleSection(doc: Document): Person[] {
    const section = _findSectionContainer(doc, 'lide');
    if (!section) return [];
    
    const links = section.querySelectorAll("a[href*='../lide/clovek.pl']");
    const people: Person[] = [];

    links.forEach(link => {
        const href = link.getAttribute('href')?.replace('../', '') ?? '';
        const name = link.textContent?.trim() ?? 'Unknown Name';
        const detailsNode = link.nextSibling;
        const details = detailsNode ? detailsNode.textContent?.trim().replace(/^-/, '').trim() ?? '' : '';

        people.push({
            id: new URLSearchParams(href.split('?')[1]).get('id'),
            name,
            link: BASE_URL + href,
            details,
        });
    });
    return people;
}

function _parseSubjectsSection(doc: Document): Subject[] {
    const section = _findSectionContainer(doc, 'predmety');
    if (!section) return [];

    // Assuming subjects are in a table, or at least have a consistent link structure
    const links = section.querySelectorAll("a[href*='../katalog/']");
    const subjects: Subject[] = [];

    links.forEach(link => {
        const href = link.getAttribute('href')?.replace('../', '') ?? '';
        // "EBC-ALG Algoritmizace - ZS 2025/2026 - PEF"
        const fullText = link.textContent?.trim() ?? '';
        const parts = fullText.split(' - ');
        
        const codeAndName = parts[0] ?? '';
        const firstSpaceIndex = codeAndName.indexOf(' ');

        subjects.push({
            link: BASE_URL + href,
            code: firstSpaceIndex > -1 ? codeAndName.substring(0, firstSpaceIndex) : null,
            name: firstSpaceIndex > -1 ? codeAndName.substring(firstSpaceIndex + 1) : codeAndName,
            semesterInfo: parts[1] ?? null,
            faculty: parts[2] ?? null,
        });
    });
    return subjects;
}

function _parseDocumentsSection(doc: Document): SearchDocument[] {
    const section = _findSectionContainer(doc, 'ds');
    if (!section) return [];
    
    // Find all table rows or containers for each document
    const containers = section.querySelectorAll("td.odsazena[valign='center']");
    const documents: SearchDocument[] = [];

    containers.forEach(td => {
        const mainLink = td.querySelector("a[href*='dokumenty_cteni.pl']");
        const folderLink = td.querySelector("a[href*='slozka.pl']");
        const authorLink = td.querySelector("a[href*='lide/clovek.pl']");

        const descriptionNode = mainLink?.nextSibling;
        const dateNode = authorLink?.nextSibling;

        const authorHref = authorLink?.getAttribute('href') ?? '';

        documents.push({
            title: mainLink?.textContent?.trim() ?? 'Untitled',
            link: BASE_URL + mainLink?.getAttribute('href')?.replace('../', ''),
            description: descriptionNode ? descriptionNode.textContent?.replace(',', '').trim() ?? null : null,
            folder: folderLink ? {
                name: folderLink.textContent?.trim() ?? '',
                link: BASE_URL + folderLink.getAttribute('href')?.replace('../', ''),
            } : null,
            author: authorLink ? {
                name: authorLink.textContent?.trim() ?? '',
                id: new URLSearchParams(authorHref.split('?')[1]).get('id'),
                link: BASE_URL + authorHref.replace('../', ''),
            } : null,
            date: dateNode ? dateNode.textContent?.replace(',', '').trim() ?? null : null,
        });
    });
    return documents;
}