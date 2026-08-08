import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { SuggestionRow } from '../../types/suggestions';

const TYPE_BADGE: Record<SuggestionRow['type'], string> = {
  bug: 'badge-error',
  idea: 'badge-warning',
  other: 'badge-ghost',
};

export function SuggestionsInbox() {
  const items = useAppStore((s) => s.suggestions);
  const update = useAppStore((s) => s.updateSuggestionStatus);
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <p className="text-sm text-base-content/60 py-6 text-center">{t('admin.noSuggestions')}</p>
    );
  }

  return (
    <ul className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
      {items.map((s) => (
        <li
          key={s.id}
          className={`rounded-lg border border-base-300 p-3 ${
            s.status === 'new' ? 'bg-base-200' : 'bg-base-100 opacity-60'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-sm break-words">{s.title}</span>
            <span className={`badge badge-sm shrink-0 ${TYPE_BADGE[s.type]}`}>{s.type}</span>
          </div>
          <p className="text-xs text-base-content/70 mt-1 whitespace-pre-wrap break-words">
            {s.body}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-base-content/50">
            <span>{s.screen}</span>
            <span>
              {s.browser_name} {s.browser_version}
            </span>
            <span>{s.viewport}</span>
            <span>{new Date(s.created_at).toLocaleDateString()}</span>
            {s.contact && <span className="break-all">{s.contact}</span>}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => void update(s.id, 'triaged')}
              disabled={s.status !== 'new'}
            >
              {t('admin.markTriaged')}
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => void update(s.id, 'done')}
              disabled={s.status === 'done'}
            >
              {t('admin.markDone')}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
