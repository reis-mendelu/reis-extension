export interface Person {
    id: string | null;
    name: string;
    link: string;
    faculty: string; // The primary faculty or department
    programAndMode: string; // Additional details or roles
    status: string; // e.g., "Student", "Staff", or academic term
    rawDetails: string; // The full, unparsed details
}

/**
 * Parses HTML from MENDELU to find person data.
 * It handles multi-result list pages, single-person profile pages, and no-result pages.
 *
 * @param {string} htmlString The raw HTML from the server.
 * @returns {Array<Person>} An array of person objects.
 */
export function parseMendeluResults(htmlString: string): Person[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/lide/";

    // --- Case 1: Check for the multi-result list page ---
    const personLinks = doc.querySelectorAll("a[href*='clovek.pl?zpet=']");
    if (personLinks.length > 0) {
        return Array.from(personLinks).map(link => {
            const name = link.textContent?.trim() ?? 'Unknown Name';
            const href = link.getAttribute('href') ?? '';
            const idMatch = href.match(/id=(\d+)/);
            const id = idMatch ? idMatch[1] : null;

            const detailsNode = link.nextSibling;
            const rawDetails = detailsNode ? detailsNode.textContent?.trim().replace(/^-/, '').trim() ?? '' : 'No details';

            const statusMatch = rawDetails.match(/\[(.*?)\]$/);
            const status = statusMatch ? statusMatch[1].trim() : 'N/A';
            const primaryInfo = rawDetails.replace(statusMatch ? statusMatch[0] : '', '').trim();
            const parts = primaryInfo.split(/\s+/);
            const faculty = parts[0] ?? 'N/A';
            const programAndMode = parts.slice(1).join(' ');

            return { id, name, link: baseUrl + href, faculty, programAndMode, status, rawDetails };
        });
    }

    // --- Case 2: Check for a single-person profile page (using your helpful snippet) ---
    // We look for a unique element on that page, like the name in the big font.
    const nameElement = doc.querySelector('td.odsazena b font[size="+1"]');
    if (nameElement) {
        const name = nameElement.textContent?.trim() ?? 'Unknown Name';
        let id: string | null = null;
        const allTds = doc.querySelectorAll('td.odsazena');
        
        // Find the TD with the identification number to extract the ID
        allTds.forEach(td => {
            const text = td.textContent ?? '';
            if (text.includes('Identification number:')) {
                const idMatch = text.match(/Identification number:\s*(\d+)/);
                if (idMatch) {
                    id = idMatch[1];
                }
            }
        });
        
        // Collect all roles and departments as details
        const roles: string[] = [];
        const departmentLinks = doc.querySelectorAll("a[href*='pracoviste.pl']");
        departmentLinks.forEach(link => {
            // Get the full text of the parent table cell (<td>) for the complete role description
            roles.push(link.parentElement?.textContent?.trim() ?? '');
        });
        const rawDetails = roles.join('\n'); // Join roles with a newline

        return [{
            id: id,
            name: name,
            link: id ? `${baseUrl}clovek.pl?id=${id}` : '', // Construct the link ourselves
            faculty: roles.length > 0 ? roles[0] : 'N/A', // Use the first role as primary
            programAndMode: 'Staff Profile',
            status: 'Staff', // Assume staff if it's this kind of page
            rawDetails: rawDetails,
        }];
    }

    // --- Case 3: No results found on either page type ---
    return [];
}