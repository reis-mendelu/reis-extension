import type { SchoolStats } from '../../api/schoolStats';
import type { UsageGroup } from '../../api/usageStats';

/**
 * The "Pro školu" card as plain Czech text, for an email or a one-pager to
 * MENDELU. Always Czech, whatever the console's language: the reader is the
 * faculty, not the admin.
 */
const HIDDEN = 'méně než 10';

const num = (n: number) => (n < 0 ? HIDDEN : n.toLocaleString('cs-CZ'));

/** '2026-10-19' → '19. 10.' — split by hand so no time zone can move the day. */
export const dayMonth = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}.`;
};
export const fullDate = (iso: string) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;

const groupLine = (groups: UsageGroup[]) =>
  groups.map((g) => `${g.key === 'unknown' ? 'neuvedeno' : g.key} ${num(g.devices)}`).join(' · ');

export function schoolStatsText(s: SchoolStats): string {
  const lines = [
    `reIS v číslech, týden ${dayMonth(s.weekFrom)} – ${fullDate(s.weekTo)}`,
    '',
    `Pravidelní uživatelé (2+ dny v týdnu): ${num(s.regulars)}, z toho na telefonu ${num(s.regularsPhone)}`,
  ];
  if (s.regularsByFaculty.length > 0)
    lines.push(`Podle fakulty: ${groupLine(s.regularsByFaculty)}`);

  if (s.eduroamSince) {
    lines.push(
      '',
      `eduroam nastavený přes reIS od ${fullDate(s.eduroamSince)}: ${num(s.eduroamWifi)} telefonů, ` +
        `${num(s.eduroamProfile)} notebooků – certifikát vydává UIS a zůstává v zařízení, reIS ho nevidí`
    );
    if (s.eduroamByFaculty.length > 0)
      lines.push(`Podle fakulty: ${groupLine(s.eduroamByFaculty)}`);
  }

  const e = s.events;
  lines.push(
    '',
    `Akce v reISu: ${num(e.posts)} příspěvků, ${num(e.views)} zobrazení, ${num(e.clicks)} prokliků, ` +
      `${num(e.mapViews)} otevření na mapě`
  );

  if (s.notices.length > 0) {
    lines.push('', 'Oznámení v Novinkách (kolik zařízení ho vidělo):');
    for (const q of s.notices) lines.push(`„${q.prompt}“: ${num(q.seen)} zařízení`);
  }

  lines.push('', 'Počty zařízení, ne lidí. Skupiny pod 10 jsou skryté.');
  return lines.join('\n');
}
