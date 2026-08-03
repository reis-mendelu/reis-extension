/** Long enough for any real IS document name, short enough for every filesystem. */
const MAX_LENGTH = 200;

const FALLBACK = 'dokument';

/**
 * Reduces an IS-supplied filename to a single, harmless path segment.
 *
 * The name comes from `Content-Disposition` or from parsed IS HTML — it is
 * server-controlled text, not something reIS chose. Native save paths treat it
 * as a *path*: `Filesystem.writeFile` resolves it relative to the target
 * directory with `recursive: true`, and the pre-API-29 Downloads branch passes
 * it to `new File(dir, name)`. Either would follow `../` out of the intended
 * directory and overwrite files the app owns.
 *
 * So: keep the basename only, drop control characters (a NUL truncates the path
 * in native code), and never return something that is empty or a bare directory
 * reference. Diacritics are preserved — Czech document names are full of them
 * and they are perfectly valid in a filename.
 */
export function safeFilename(raw: string): string {
  // Everything before the last separator is a directory, including any `..`.
  const base = raw.split(/[/\\]/).pop() ?? '';

  const cleaned = base
    // eslint-disable-next-line no-control-regex -- these are exactly what we strip
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/^\.+/, '')
    .trim();

  if (!cleaned) return FALLBACK;
  return cleaned.length > MAX_LENGTH ? truncateKeepingExtension(cleaned) : cleaned;
}

/** A file with its extension cut off will not open in anything. */
function truncateKeepingExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : '';
  return name.slice(0, MAX_LENGTH - ext.length) + ext;
}
