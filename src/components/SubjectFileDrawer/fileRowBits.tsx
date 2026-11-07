/** Small pieces of a file row, kept apart so FileListItem stays a single component. */
import type { DownloadTick } from '../../hooks/ui/readBlobWithProgress';

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

/**
 * The quiet second line of a row or a document heading: date and who put it
 * there; IS's comment gets a line of its own. The author tells a student whose
 * seminar a file is for when two teachers share one folder ("cvičení 05 -
 * turcinek" beside "cvičení 05 - Pisařovic").
 */
export function FileRowMeta({ date, author }: { date?: string; author?: string }) {
  return (
    <>
      {date && <span className="shrink-0">{date}</span>}
      {author && <span className="truncate">{author}</span>}
    </>
  );
}

/**
 * Along a busy row's bottom edge, not only in the 24px button: a spinner that
 * small was "not visible enough" (#372). Determinate when the transport can
 * count bytes against a Content-Length; indeterminate when it cannot —
 * Capacitor hands the whole file over at once, and IS sends no length for the
 * PDFs it generates. Hidden from assistive tech: the ring in the button is the
 * announced progressbar, and a second one would read the same download out twice.
 */
export function RowProgressBar({ tick }: { tick: DownloadTick | null }) {
  return (
    <progress
      aria-hidden="true"
      {...(tick?.total ? { value: tick.loaded, max: tick.total } : {})}
      className="progress progress-primary absolute inset-x-0 bottom-0 h-1 rounded-none"
    />
  );
}
