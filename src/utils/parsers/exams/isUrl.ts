const IS_BASE = 'https://is.mendelu.cz';

/**
 * An IS Mendelu URL from whatever an anchor in the terms tables carries.
 *
 * Operace-cell anchors (Podrobnosti, Odhlásit) emit bare-relative hrefs like
 * "terminy_info.pl?termin=…" — the source page lives at /auth/student/, which
 * is where the browser would resolve them. Anchor explicitly there rather than
 * at the IS root, which 404s.
 */
export function absoluteIsUrl(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${IS_BASE}${href}`;
  return `${IS_BASE}/auth/student/${href}`;
}
