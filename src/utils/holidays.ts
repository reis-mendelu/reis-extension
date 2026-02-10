export const getCzechHoliday = (date: Date, lang: 'cs' | 'en' = 'cs'): string | null => {
    const isEn = lang === 'en';
    const day = date.getDate();
    const month = date.getMonth() + 1; // 0-indexed
    const year = date.getFullYear();

    // Fixed holidays
    if (day === 1 && month === 1) return isEn ? "Restoration Day of the Independent Czech State" : "Den obnovy samostatného českého státu";
    if (day === 1 && month === 5) return isEn ? "Labour Day" : "Svátek práce";
    if (day === 8 && month === 5) return isEn ? "Victory in Europe Day" : "Den vítězství";
    if (day === 5 && month === 7) return isEn ? "Saints Cyril and Methodius Day" : "Den slovanských věrozvěstů Cyrila a Metoděje";
    if (day === 6 && month === 7) return isEn ? "Jan Hus Day" : "Den upálení mistra Jana Husa";
    if (day === 28 && month === 9) return isEn ? "St. Wenceslas Day (Czech Statehood Day)" : "Den české státnosti";
    if (day === 28 && month === 10) return isEn ? "Independent Czechoslovak State Day" : "Den vzniku samostatného československého státu";
    if (day === 17 && month === 11) return isEn ? "Struggle for Freedom and Democracy Day" : "Den boje za svobodu a demokracii";
    if (day === 24 && month === 12) return isEn ? "Christmas Eve" : "Štědrý den";
    if (day === 25 && month === 12) return isEn ? "Christmas Day" : "1. svátek vánoční";
    if (day === 26 && month === 12) return isEn ? "St. Stephen's Day" : "2. svátek vánoční";

    // Easter calculation (Meeus/Jones/Butcher's algorithm)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);

    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

    const easterSunday = new Date(year, easterMonth - 1, easterDay);

    // Good Friday (2 days before Easter Sunday)
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);

    // Easter Monday (1 day after Easter Sunday)
    const easterMonday = new Date(easterSunday);
    easterMonday.setDate(easterSunday.getDate() + 1);

    if (date.getDate() === goodFriday.getDate() && date.getMonth() === goodFriday.getMonth()) return isEn ? "Good Friday" : "Velký pátek";
    if (date.getDate() === easterMonday.getDate() && date.getMonth() === easterMonday.getMonth()) return isEn ? "Easter Monday" : "Velikonoční pondělí";

    return null;
};
