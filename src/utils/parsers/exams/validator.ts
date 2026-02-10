export function validateHtmlStructure(doc: Document): void {
    const warnings: string[] = [];
    const table1 = doc.querySelector('#table_1');
    const table2 = doc.querySelector('#table_2');

    if (!table1 && !table2) {
        warnings.push('Neither #table_1 nor #table_2 found - page structure may have changed');
    }

    if (table2) {
        const headers = Array.from(table2.querySelectorAll('thead th')).map(h => h.textContent?.trim() || '');
        const missing = ['Datum/Date', 'Místnost/Where', 'Zkouška/Type'].filter(eh => {
            const [cz, en] = eh.split('/');
            return !headers.some(ht => ht.toLowerCase().includes(cz.toLowerCase()) || ht.toLowerCase().includes(en.toLowerCase()));
        });
        if (missing.length > 0) {
            warnings.push(`Missing expected headers: ${missing.join(', ')}`);
            warnings.push(`Actual headers found: [${headers.join(', ')}]`);
        }
    }

    if (warnings.length > 0) {
        console.warn('[parseExamData] ⚠️ HTML structure validation warnings:');
        warnings.forEach(w => console.warn(`  - ${w}`));
    }
}
