import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

/**
 * "Oznámení z IS" (reis_admin only, inside Otázky on both console layouts).
 *
 * Every student sees the notices of their OWN IS home page in Novinky under
 * MENDELU; nothing about them reaches reIS. The admin's only lever is muting a
 * notice for everyone, by its key. The list is therefore what the ADMIN's own
 * IS shows, plus whatever is already muted, so a mute can be undone after the
 * notice has left the admin's IS.
 */
export function IsNoticesPanel() {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const byLang = useAppStore((s) => s.isNotices);
  const notices = byLang[language] ?? [];
  const mutes = useAppStore((s) => s.isNoticeMutes);
  const setMuted = useAppStore((s) => s.setIsNoticeMuted);
  const [busy, setBusy] = useState<string | null>(null);

  const muted = new Set(mutes.map((m) => m.key));
  const rows = [
    ...notices.map((n) => ({ key: n.key, title: n.title, inMyIs: true })),
    ...mutes
      .filter((m) => !notices.some((n) => n.key === m.key))
      .map((m) => ({ key: m.key, title: m.title, inMyIs: false })),
  ];

  const toggle = async (row: { key: string; title: string }) => {
    setBusy(row.key);
    const ok = await setMuted(row, !muted.has(row.key));
    setBusy(null);
    if (!ok) toast.error(t('admin.isNotices.error'));
  };

  return (
    <section data-testid="admin-is-notices" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-base-content">{t('admin.isNotices.title')}</h3>
      <p className="text-xs text-base-content/70">{t('admin.isNotices.note')}</p>
      {rows.length === 0 && (
        <p className="text-sm text-base-content/70">{t('admin.isNotices.empty')}</p>
      )}
      {rows.map((row) => {
        const isMuted = muted.has(row.key);
        return (
          <div
            key={row.key}
            className="flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={`truncate text-sm font-medium ${isMuted ? 'text-base-content/70 line-through' : 'text-base-content'}`}
              >
                {row.title}
              </span>
              {(isMuted || !row.inMyIs) && (
                <span className="text-xs text-base-content/70">
                  {[
                    isMuted && t('admin.isNotices.hidden'),
                    !row.inMyIs && t('admin.isNotices.notInYourIs'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </div>
            <button
              type="button"
              className={`btn btn-sm shrink-0 ${isMuted ? 'btn-ghost' : 'btn-outline'}`}
              disabled={busy === row.key}
              onClick={() => void toggle(row)}
            >
              {isMuted ? t('admin.isNotices.show') : t('admin.isNotices.hide')}
            </button>
          </div>
        );
      })}
    </section>
  );
}
