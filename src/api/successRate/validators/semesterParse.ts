export function parseSemesterName(name: string) {
    const isWinter = name.startsWith('ZS'), m = name.match(/(\d{4})\/(\d{4})/), y = m ? parseInt(m[1]) : 0;
    const ys = y % 100;
    return { isWinter, yearStart: y, yearLabel: `${isWinter ? 'ZS' : 'LS'} ${ys}/${ys + 1}` };
}
