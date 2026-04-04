/** Pure elective = group says "volitelných" but NOT "povinně volitelných" */
export function isElectiveGroup(groupName: string, blockTitle: string): boolean {
  const g = groupName.toLowerCase();
  const b = blockTitle.toLowerCase();
  const gElective = (g.includes('volitel') && !g.includes('povinně') && !g.includes('povin'))
    || (g.includes('elective') && !g.includes('compulsory'))
    || (g.includes('optional') && !g.includes('compulsory'));
  const bElective = b.includes('volitelné předměty') || b.includes('optional courses');
  return gElective || bElective;
}
