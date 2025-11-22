export interface ExamEvent {
    id: string;
    title: string;
    start: string; // ISO String
    location: string;
    meta: {
        teacher: string;
        capacity: string;
        deadline_logout: string;
    };
    actions: {
        info_url: string;
        logout_url: string;
    };
}

export function parseRegisteredExams(html: string): ExamEvent[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('#table_1');

    if (!table) {
        console.warn("Exam table #table_1 not found in HTML");
        return [];
    }

    const rows = table.querySelectorAll('tbody > tr');
    const events: ExamEvent[] = [];

    rows.forEach((row) => {
        // Skip if not a valid row (though querySelectorAll should handle structure)
        const cells = row.querySelectorAll('td');

        if (cells.length < 13) {
            return;
        }

        // Column Mapping (Zero-based)
        // 1: Subject Code
        const subjectCode = cells[1]?.textContent?.trim() || '';

        // 2: Subject Name (inside <a>)
        const subjectNameAnchor = cells[2].querySelector('a');
        const subjectName = subjectNameAnchor?.textContent?.trim() || cells[2].textContent?.trim() || '';

        // 4: Date & Time -> DD.MM.YYYY HH:MM (day)
        const dateRaw = cells[4].textContent?.trim() || '';
        // Regex remove the \s\(.*\) part
        const dateClean = dateRaw.replace(/\s*\(.*\)/, '');
        // Parse to ISO
        // Format: DD.MM.YYYY HH:MM
        const [datePart, timePart] = dateClean.split(' ');
        let isoDate = '';
        if (datePart && timePart) {
            const [day, month, year] = datePart.split('.');
            // Create date object (assuming local time or specific timezone, usually IS is local/CET)
            // We'll construct ISO string manually to preserve what we have or use Date
            // ISO format: YYYY-MM-DDTHH:mm:00
            isoDate = `${year}-${month}-${day}T${timePart}:00`;
        }

        // 5: Location
        const locationAnchor = cells[5].querySelector('a');
        const location = locationAnchor?.textContent?.trim() || cells[5].textContent?.trim() || '';

        // 6: Exam Type
        const examType = cells[6].textContent?.trim() || '';

        // 7: Teacher
        const teacher = cells[7].textContent?.trim() || '';

        // 8: Capacity (Přihlášeno)
        const capacity = cells[8].textContent?.trim() || '';

        // 10: Deadlines
        // Use textContent to avoid XSS risks from innerHTML
        const deadlinesText = cells[10].textContent || '';
        // Split by newlines or multiple spaces that would indicate line breaks
        const deadlinesParts = deadlinesText.split(/\n+/).map(s => s.trim()).filter(Boolean);
        // Line 1: Reg from, Line 2: Reg to, Line 3: Unreg to
        const deadlineLogout = deadlinesParts.length >= 3 ? deadlinesParts[2] : '';

        // 11: Info URL
        const infoAnchor = cells[11].querySelector('a');
        let infoUrl = infoAnchor?.getAttribute('href') || '';
        if (infoUrl && !infoUrl.startsWith('http')) {
            infoUrl = `https://is.mendelu.cz/auth/student/${infoUrl}`;
        }

        // 12: Logout URL
        const logoutAnchor = cells[12].querySelector('a');
        let logoutUrl = logoutAnchor?.getAttribute('href') || '';
        if (logoutUrl && !logoutUrl.startsWith('http')) {
            logoutUrl = `https://is.mendelu.cz/auth/student/${logoutUrl}`;
        }

        events.push({
            id: subjectCode,
            title: `${subjectName} - ${examType}`,
            start: isoDate,
            location: location,
            meta: {
                teacher,
                capacity,
                deadline_logout: deadlineLogout
            },
            actions: {
                info_url: infoUrl,
                logout_url: logoutUrl
            }
        });
    });

    return events;
}
