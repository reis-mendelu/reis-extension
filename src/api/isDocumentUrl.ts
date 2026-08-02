/**
 * IS exposes each document twice: a `dokumenty_cteni.pl` VIEWER page and a
 * `slozka.pl?download=` direct file. The documents parser collects both anchors
 * from a row, so a file link in reIS may be either one.
 *
 * reIS must never send the student into the old IS UI, so a viewer link is
 * rewritten to its direct download instead of being opened.
 *
 * The rewrite is a pure transform — verified against a live response, the
 * viewer's `dok` is exactly the `download` id:
 *
 *   dokumenty_cteni.pl?id=153920;on=0;dok=359057;serializace=…;lang=cz
 *   → slozka.pl?download=359057;id=153920;z=1;lang=cz
 *
 * so no extra request and no HTML parsing is needed. The `serializace` token is
 * session-scoped and deliberately dropped; the download does not require it.
 *
 * IS separates query params with `;` (occasionally `&`), which is why this
 * cannot use URLSearchParams directly.
 */
const DOK_SERVER = 'https://is.mendelu.cz/auth/dok_server';

function readParam(query: string, name: string): string | null {
  const m = query.match(new RegExp(`(?:^|[;&?])${name}=([^;&]+)`));
  return m?.[1] ?? null;
}

/**
 * Returns the direct-download URL for an IS document link, or null when the URL
 * is not a document link at all. An already-direct link is returned unchanged.
 */
export function toDirectDownloadUrl(url: string): string | null {
  if (url.includes('slozka.pl') && url.includes('download=')) return url;
  if (!url.includes('dokumenty_cteni.pl')) return null;

  const query = url.slice(url.indexOf('?') + 1);
  const dok = readParam(query, 'dok');
  const id = readParam(query, 'id');
  // Both are required: `download` identifies the file, `id` its folder. Guessing
  // either would produce a plausible URL that serves the wrong document.
  if (!dok || !id) return null;

  const lang = readParam(query, 'lang') ?? 'cz';
  return `${DOK_SERVER}/slozka.pl?download=${dok};id=${id};z=1;lang=${lang}`;
}
