import type { VolneKapacityRoom } from '../../../types/iskam';

export function parseVolneKapacity(html: string): VolneKapacityRoom[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table tbody tr'));
  const out: VolneKapacityRoom[] = [];

  for (const row of rows) {
    const tds = row.querySelectorAll('td');
    if (tds.length < 5) continue;
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const floor = tds[0].textContent?.trim() ?? '';
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const room = tds[1].textContent?.trim() ?? '';
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const beds = parseInt(tds[3].textContent?.trim() ?? '0', 10);
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const free = parseInt(tds[4].textContent?.trim() ?? '0', 10);
    const nationalities = tds[6]?.textContent?.trim() ?? '';
    if (!room) continue;
    out.push({ floor, room, beds, free, nationalities });
  }
  return out;
}
