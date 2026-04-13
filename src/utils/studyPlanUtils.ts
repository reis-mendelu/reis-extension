/** strictly mandatory subjects */
export function isCompulsoryGroup(groupName: string | undefined, blockTitle: string | undefined): boolean {
  const g = (groupName || '').toLowerCase();
  const b = (blockTitle || '').toLowerCase();
  return (g.includes('povinných') && !g.includes('volitel'))
    || (g.includes('compulsory') && !g.includes('elective'))
    || (b.includes('povinné předměty') && !b.includes('volitel'));
}

/** mandatory group, but choice of subjects */
export function isCoreElectiveGroup(groupName: string | undefined): boolean {
  const g = (groupName || '').toLowerCase();
  return g.includes('povinně volitel') || g.includes('elective compulsory');
}

/** Pure elective = group says "volitelných" but NOT "povinně volitelných" */
export function isElectiveGroup(groupName: string | undefined, blockTitle: string | undefined): boolean {
  if (isCoreElectiveGroup(groupName)) return false;
  if (isCompulsoryGroup(groupName, blockTitle)) return false;

  const g = (groupName || '').toLowerCase();
  const b = (blockTitle || '').toLowerCase();
  const gElective = g.includes('volitel') || g.includes('elective') || g.includes('optional');
  const bElective = b.includes('volitelné předměty') || b.includes('optional courses');
  return gElective || bElective;
}
