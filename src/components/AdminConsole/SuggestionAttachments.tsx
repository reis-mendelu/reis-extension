import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { SuggestionAttachment, SuggestionAttachmentSummary } from '../../types/suggestions';

interface Props {
  id: number;
  summary: SuggestionAttachmentSummary;
}

/**
 * A report's screenshot and technical details. The list row shows only the
 * counts; the bytes load when an admin opens this, through the store.
 */
export function SuggestionAttachments({ id, summary }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const loaded = useAppStore((s) => s.suggestionAttachments[id]);
  const load = useAppStore((s) => s.loadSuggestionAttachments);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {summary.has_screenshot && (
          <span className="badge badge-sm badge-ghost">{t('admin.screenshotBadge')}</span>
        )}
        {summary.diagnostics_count > 0 && (
          <span className="badge badge-sm badge-ghost">
            {t('admin.entriesBadge', { count: summary.diagnostics_count })}
          </span>
        )}
        <button
          type="button"
          className="btn btn-xs btn-outline gap-1"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            if (!open) void load(id);
          }}
        >
          <Paperclip size={12} aria-hidden="true" />
          {t('admin.attachments')}
        </button>
      </div>
      {open && <Loaded value={loaded} />}
    </div>
  );
}

function Loaded({ value }: { value: SuggestionAttachment | 'loading' | 'error' | undefined }) {
  const { t } = useTranslation();
  if (value === undefined || value === 'loading') {
    return <p className="text-xs text-base-content/70 mt-2">{t('admin.attachmentsLoading')}</p>;
  }
  if (value === 'error') {
    return <p className="text-xs text-error mt-2">{t('admin.attachmentsError')}</p>;
  }
  if (!value.screenshot && !value.diagnostics) {
    return <p className="text-xs text-base-content/70 mt-2">{t('admin.attachmentsGone')}</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      {value.screenshot && <Screenshot src={value.screenshot} />}
      {value.diagnostics && <DiagnosticsTable d={value.diagnostics} />}
    </div>
  );
}

function Screenshot({ src }: { src: string }) {
  const { t } = useTranslation();
  const [full, setFull] = useState(false);
  return (
    <button type="button" onClick={() => setFull((v) => !v)} className="block">
      <img
        src={src}
        alt={t('admin.screenshotAlt') as string}
        className={`rounded-md border border-base-300 ${full ? 'w-full h-auto' : 'h-40 w-auto'}`}
      />
    </button>
  );
}

function DiagnosticsTable({ d }: { d: NonNullable<SuggestionAttachment['diagnostics']> }) {
  const time = (ms: number) => new Date(ms).toLocaleTimeString();
  return (
    <div className="rounded-lg bg-base-200 p-2 text-[11px] leading-snug text-base-content/80 font-mono">
      <p className="break-words">
        {d.env.platform} · {d.env.os} · {d.env.lang} · {d.env.online ? 'online' : 'offline'} · up{' '}
        {d.env.uptimeS}s
      </p>
      <p className="break-words">
        sync {d.sync.schedule}/{d.sync.exams} · {d.sync.scheduleCount} lessons · {d.sync.examsCount}{' '}
        exams · last {d.sync.lastSync ? time(d.sync.lastSync) : '—'}
      </p>
      <ul className="mt-1 max-h-56 overflow-y-auto space-y-1">
        {d.entries.map((e, i) => (
          <li key={`${e.t}-${i}`} className="break-words">
            {/* The dot carries the colour: red text on base-200 fails AA in the
                light theme, and the word must stay readable. */}
            <span
              aria-hidden="true"
              className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-1 ${
                e.level === 'error' ? 'bg-error' : 'bg-warning'
              }`}
            />
            <span className="font-semibold">{e.level}</span> {time(e.t)} {e.source} {e.ctx ?? ''}{' '}
            {e.status ?? ''} {e.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
