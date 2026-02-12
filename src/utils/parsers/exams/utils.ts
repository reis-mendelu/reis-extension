export function normalizeDateString(dateStr: string, isEn: boolean): string {
    if (!dateStr || dateStr === '--') return dateStr;
    
    // Check if it includes time and/or day name: "02/16/2026 10:00 (Mon)" or "16.02.2026 10:00 (po)"
    const mainPart = dateStr.split(' ')[0];
    const timePart = dateStr.split(' ')[1] || '';
    
    let day = '';
    let month = '';
    let year = '';

    if (isEn && mainPart.includes('/')) {
        // English format: MM/DD/YYYY
        [month, day, year] = mainPart.split('/');
    } else if (mainPart.includes('.')) {
        // Czech format: DD.MM.YYYY
        [day, month, year] = mainPart.split('.');
    } else {
        return dateStr; // Unrecognized format
    }

    // Ensure 2 digits for day/month
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    
    const normalizedDate = `${day}.${month}.${year}`;
    return timePart ? `${normalizedDate} ${timePart}` : normalizedDate;
}
