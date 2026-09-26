import { Check, Copy, Pencil, Trash2, X } from 'lucide-react';

/**
 * A row's controls in the console's event list: duplicate, edit, and a
 * two-step in-row delete (the trash icon arms it, the check commits) so
 * authoring never leaves the column.
 */
export function AdminEventRowActions({
  confirming,
  busy,
  onDuplicate,
  onEdit,
  onArmDelete,
  onCancelDelete,
  onDelete,
  t,
}: {
  confirming: boolean;
  busy: boolean;
  onDuplicate: () => void;
  onEdit: () => void;
  onArmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  t: (k: string) => string;
}) {
  const quiet = 'btn btn-ghost btn-xs px-1.5 text-base-content/45';
  if (confirming) {
    return (
      <>
        <button
          type="button"
          className="btn btn-ghost btn-xs px-1.5 text-error"
          aria-label={t('map.deleteConfirm')}
          disabled={busy}
          onClick={onDelete}
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs px-1.5"
          aria-label={t('common.cancel')}
          onClick={onCancelDelete}
        >
          <X size={15} />
        </button>
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        className={`${quiet} hover:text-base-content`}
        aria-label={t('map.duplicate')}
        title={t('map.duplicate')}
        onClick={onDuplicate}
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        className={`${quiet} hover:text-base-content`}
        aria-label={t('map.edit')}
        onClick={onEdit}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className={`${quiet} hover:text-error`}
        aria-label={t('map.delete')}
        onClick={onArmDelete}
      >
        <Trash2 size={14} />
      </button>
    </>
  );
}
