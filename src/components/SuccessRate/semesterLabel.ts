/** "ZS 25/26" / "WS 25/26" — the label the semester chips print, shared with
 * the garant note so both name a semester the same way. */
export function semesterLabel(
  t: (key: string) => string,
  year: number,
  semesterName: string
): string {
  const kind = semesterName.startsWith('ZS') ? t('days.winterSemester') : t('days.summerSemester');
  return `${kind} ${year % 100}/${(year % 100) + 1}`;
}
