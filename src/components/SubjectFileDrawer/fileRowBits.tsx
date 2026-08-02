/** The file-type badge, kept apart so FileListItem stays a single component. */

const typeBadgeConfig: Record<string, string> = {
  pdf: 'badge-error',
  xls: 'badge-success',
  xlsx: 'badge-success',
  csv: 'badge-success',
  ppt: 'badge-warning',
  pptx: 'badge-warning',
  doc: 'badge-info',
  docx: 'badge-info',
  txt: 'badge-info',
  rtf: 'badge-info',
  zip: 'badge-warning badge-outline',
  rar: 'badge-warning badge-outline',
  '7z': 'badge-warning badge-outline',
};

export function FileTypeBadge({ type }: { type: string }) {
  const label = type === 'unknown' ? 'FILE' : type.toUpperCase();
  const cls = typeBadgeConfig[type] || 'badge-ghost';
  return <span className={`badge badge-sm font-mono text-[10px] ${cls}`}>{label}</span>;
}
