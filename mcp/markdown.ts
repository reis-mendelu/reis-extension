const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const scalar = (v: unknown) =>
  String(v)
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');

function isFlatRow(v: unknown): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v).every((x) => x === null || typeof x !== 'object')
  );
}

function table(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map((r) => line(headers.map((h) => (isEmpty(r[h]) ? '' : scalar(r[h]))))),
  ].join('\n');
}

function bullets(value: unknown, indent: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      item && typeof item === 'object'
        ? [`${indent}-`, ...bullets(item, indent + '  ')]
        : [`${indent}- ${scalar(item)}`]
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => {
      if (isEmpty(v)) return [];
      if (typeof v === 'object') return [`${indent}- **${k}:**`, ...bullets(v, indent + '  ')];
      // Multi-line text (a lecture's extracted text, a syllabus section)
      // keeps its line breaks as a block under its key.
      if (typeof v === 'string' && v.includes('\n')) {
        return [`${indent}- **${k}:**`, '', ...v.split('\n').map((l) => `${indent}  ${l}`), ''];
      }
      return [`${indent}- **${k}:** ${scalar(v)}`];
    });
  }
  return [`${indent}${scalar(value)}`];
}

/** Generic, predictable rendering: tables for lists of flat rows, bullets otherwise. */
export function toMarkdown(value: unknown): string {
  if (isEmpty(value)) return 'Nothing found.';
  if (Array.isArray(value) && value.every(isFlatRow)) return table(value);
  return bullets(value, '').join('\n');
}
