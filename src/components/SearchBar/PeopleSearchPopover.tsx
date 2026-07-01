import { useState } from 'react';
import { Search, X, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useSearch } from './useSearch';
import { useTranslation } from '../../hooks/useTranslation';
import { injectUserParams } from '../../data/pagesData';
import type { SearchResult } from './types';

interface PeopleSearchPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PeopleSearchPopover({ isOpen, onClose }: PeopleSearchPopoverProps) {
  const { t, language } = useTranslation();
  const [query, setQuery] = useState('');
  const { sections, isLoading, studiumId, saveToHistory } = useSearch(query);
  const people = sections.find(s => s.key === 'people')?.results ?? [];

  if (!isOpen) return null;

  const handlePick = (r: SearchResult) => {
    saveToHistory(r);
    if (r.link) window.open(injectUserParams(r.link, studiumId, language === 'en' ? 'en' : 'cz'), '_blank');
  };

  const hasQuery = query.trim().length >= 2;
  const emptyMessage = !hasQuery
    ? t('search.peoplePlaceholder')
    : isLoading
      ? t('search.loading')
      : people.length === 0
        ? t('search.empty')
        : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Content Container — anchored near the top (not vertically centered) so
          the input's screen position is fixed; the results area below it can
          only grow downward as the query/results change, never shifting the
          input itself */}
      <div className="relative w-full max-w-md max-h-[76vh] bg-base-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Header: query input + close */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search.peoplePlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-base-200 border border-base-300 rounded-xl text-sm text-base-content placeholder-base-content/50 focus:outline-none focus:border-primary/50 transition-colors"
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2.5 hover:bg-base-200 rounded-xl transition-colors text-base-content/50 hover:text-base-content"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results — always renders a state (hint/loading/empty/results) for
            a consistent feel; growth only extends downward from the input
            above, since the card is top-anchored rather than centered */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {emptyMessage ? (
            <div className="py-8 text-center text-sm text-base-content/50">
              {emptyMessage}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {people.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePick(p)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-base-200 transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center shrink-0 text-base-content/50">
                    <User className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{p.title}</span>
                    {p.detail && <span className="block text-[11px] text-base-content/50 truncate">{p.detail}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
