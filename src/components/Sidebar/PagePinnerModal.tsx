import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { pagesData } from '../../data/pages';
import { fuzzyIncludes } from '../../utils/searchUtils';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

interface PagePinnerModalProps {
  open: boolean;
  onClose: () => void;
}

export function PagePinnerModal({ open, onClose }: PagePinnerModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const pinnedPages = useAppStore(s => s.pinnedPages);
  const pinPage = useAppStore(s => s.pinPage);
  const unpinPage = useAppStore(s => s.unpinPage);
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const pinnedIds = new Set(pinnedPages.map(p => p.id));
  const atLimit = pinnedPages.length >= 6;

  const filtered = pagesData
    .map(cat => ({
      ...cat,
      children: cat.children.filter(p => !query || fuzzyIncludes(p.label, query)),
    }))
    .filter(cat => cat.children.length > 0);

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-md max-h-[70vh] flex flex-col p-0">
        <div className="flex flex-col items-center pt-5 pb-1">
          <img src="/reIS_logo.svg" alt="reIS" className="w-10 h-10" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="font-bold text-lg">{t('sidebar.addPinTitle')}</span>
          {atLimit && (
            <span className="text-xs text-base-content/50">{t('sidebar.pinLimitReached')}</span>
          )}
        </div>

        <div className="px-4 pb-2">
          <input
            ref={inputRef}
            type="text"
            className="w-full h-8 px-3 text-sm bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:border-primary transition-colors"
            placeholder={t('search.placeholder').replace(' ({shortcut}K)', '')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {filtered.map(cat => (
            <div key={cat.id}>
              <div className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                {cat.label}
              </div>
              {cat.children.map(page => {
                const isPinned = pinnedIds.has(page.id);
                const disabled = !isPinned && atLimit;
                return (
                  <button
                    key={page.id}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-base-200 cursor-pointer'
                    }`}
                    onClick={() => isPinned ? unpinPage(page.id) : pinPage({ id: page.id, label: page.label, href: page.href })}
                    disabled={disabled}
                  >
                    <span className="flex-1 truncate">{page.label}</span>
                    {isPinned && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
