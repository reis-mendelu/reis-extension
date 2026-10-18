import { CalendarPlus, X } from 'lucide-react';
import type { PostKind } from '../../types/events';

type T = (k: string) => string;

const TITLE: Record<PostKind, { create: string; edit: string }> = {
  event: { create: 'map.createEvent', edit: 'map.editEvent' },
  notice: { create: 'map.createNotice', edit: 'map.editNotice' },
};

// The composer's frame: its title bar and its Cancel / Publish row. Split out
// of EventComposer.tsx to keep it under its line budget; no logic of its own.

export function ComposerHeader({
  kind,
  editing,
  onClose,
  t,
}: {
  kind: PostKind;
  editing: boolean;
  onClose: () => void;
  t: T;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20">
        <CalendarPlus size={14} className="text-primary" />
      </span>
      <span className="text-sm font-bold">{t(TITLE[kind][editing ? 'edit' : 'create'])}</span>
      <button
        type="button"
        className="btn btn-ghost btn-xs ml-auto"
        aria-label={t('common.cancel')}
        onClick={onClose}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ComposerActions({
  kind,
  editing,
  disabled,
  error,
  onClose,
  onPublish,
  t,
}: {
  kind: PostKind;
  editing: boolean;
  disabled: boolean;
  error: boolean;
  onClose: () => void;
  onPublish: () => void;
  t: T;
}) {
  const label = editing
    ? 'map.saveChanges'
    : kind === 'notice'
      ? 'map.publishNotice'
      : 'map.publish';
  return (
    <>
      {error && <p className="mt-2 text-[11px] text-error">{t('admin.saveError')}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={onPublish}
        >
          {t(label)}
        </button>
      </div>
    </>
  );
}
