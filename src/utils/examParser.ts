import type { ExamSubject } from '../components/ExamDrawer';

export function parseExamData(html: string): ExamSubject[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const subjectsMap = new Map<string, ExamSubject>();

    // Helper to get or create subject
    const getOrCreateSubject = (code: string, rawName: string) => {
        // Clean name: Remove "ZS 202X/202X - FACULTY" prefix/suffix
        // Example: "ZS 2025/2026 - PEF Algoritmizace" or "Algoritmizace ZS 2025/2026 - PEF"
        // Usually it's "ZS 2025/2026 - PEF <Name>"
        let name = rawName.replace(/ZS\s+\d{4}\/\d{4}\s+-\s+\w+\s+/, '').trim();

        if (!subjectsMap.has(code)) {
            subjectsMap.set(code, {
                id: code,
                name,
                code,
                sections: []
            });
        }
        return subjectsMap.get(code)!;
    };

    // Helper to get or create section within a subject
    const getOrCreateSection = (subject: ExamSubject, sectionName: string) => {
        let section = subject.sections.find(s => s.name === sectionName);
        if (!section) {
            section = {
                id: `${subject.id}-${sectionName.replace(/\s+/g, '-').toLowerCase()}`,
                name: sectionName,
                type: sectionName.toLowerCase().includes('zkouška') ? 'exam' : 'test',
                status: 'open',
                terms: []
            };
            subject.sections.push(section);
        }
        return section;
    };

    // 1. Parse Registered Terms (Table 1)
    const table1 = doc.querySelector('#table_1');
    if (table1) {
        const rows = table1.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length < 8) return;

            const code = cols[2].textContent?.trim() || '';
            const name = cols[3].textContent?.trim() || '';
            const dateStr = cols[5].textContent?.trim() || ''; // "12.12.2025 17:00 (pá)"
            const sectionNameRaw = cols[7].textContent?.trim() || ''; // "průběžný test 2"

            // Clean up section name (remove newlines, extra spaces)
            const sectionName = sectionNameRaw.split('(')[0].trim();

            // Parse date and time
            // Example: "12.12.2025 17:00 (pá)"
            const [datePart, timePart] = dateStr.split(' ');
            const date = datePart;
            const time = timePart;

            const teacher = cols[4].textContent?.trim() || '';
            const room = cols[6].textContent?.trim() || '';

            const subject = getOrCreateSubject(code, name);
            const section = getOrCreateSection(subject, sectionName);

            section.status = 'registered';
            section.registeredTerm = {
                date,
                time,
                room,
                teacher
            };
        });
    }

    // 2. Parse Available Terms (Table 2)
    const table2 = doc.querySelector('#table_2');
    if (table2) {
        const rows = table2.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length < 10) return;

            // Col 3: Code, Col 4: Name
            const code = cols[3].textContent?.trim() || '';
            const name = cols[4].textContent?.trim() || '';
            const dateStr = cols[6].textContent?.trim() || ''; // "04.12.2025 16:00 (čt)"
            const sectionNameRaw = cols[8].textContent?.trim() || '';
            const capacityStr = cols[10].textContent?.trim() || ''; // "53/70"

            const sectionName = sectionNameRaw.split('(')[0].trim();
            const [datePart, timePart] = dateStr.split(' ');

            const room = cols[7].textContent?.trim() || '';
            const teacher = cols[9].textContent?.trim() || '';

            // Check if full
            const [occupied, total] = capacityStr.split('/').map(Number);
            const isFull = occupied >= total;

            const subject = getOrCreateSubject(code, name);
            const section = getOrCreateSection(subject, sectionName);

            // If the section is already marked as registered from Table 1, we don't need to do anything 
            // (or maybe we want to show available terms even if registered? usually IS hides them or shows them differently)
            // For now, let's append terms.

            section.terms.push({
                id: Math.random().toString(36).substr(2, 9), // Generate a random ID
                date: datePart,
                time: timePart,
                capacity: capacityStr,
                full: isFull,
                room,
                teacher
            });
        });
    }

    // Convert Map to Array
    return Array.from(subjectsMap.values());
}
