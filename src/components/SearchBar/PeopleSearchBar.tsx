import { useState, useRef, useEffect, useMemo } from 'react';
import { UserSearch, X, User } from 'lucide-react';
import { useSearch } from './useSearch';
import { useTranslation } from '../../hooks/useTranslation';
import { injectUserParams } from '../../data/pagesData';
import type { SearchResult } from './types';

/**
 * People search as an expanding inline bar.
 * Collapsed: a borderless icon button styled like the other header icons.
 * Click expands it into an inline input (people only); results drop below.
 * Click-outside / Esc collapses it.
 */
export function PeopleSearchBar() {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { sections, isLoading, studiumId, saveToHistory } = useSearch(query);
  const people = useMemo(
    () => sections.find(s => s.key === 'people')?.results ?? [],
    [sections]
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collapse on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Focus the input once the bar has expanded.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const handlePick = (r: SearchResult) => {
    saveToHistory(r);
    if (r.link) window.open(injectUserParams(r.link, studiumId, language === 'en' ? 'en' : 'cz'), '_blank');
    setOpen(false);
    setQuery('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    else if (e.key === 'Enter' && people.length > 0) handlePick(people[0]);
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex items-center overflow-hidden rounded-lg transition-all duration-300 ease-out ${
          open
            ? 'w-[300px] rounded-xl border border-primary bg-base-100 shadow-sm'
            : 'w-9 border border-transparent'
        }`}
      >
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={t('search.peoplePlaceholder')}
          className={`shrink-0 p-2 rounded-lg transition-colors ${
            open ? 'text-primary' : 'text-base-content/70 hover:bg-base-300'
          }`}
        >
          <UserSearch size={20} />
        </button>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t('search.peoplePlaceholder')}
          className={`flex-1 min-w-0 bg-transparent text-sm text-base-content placeholder-base-content/50 outline-none pr-2 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {open && query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="px-2 shrink-0 text-base-content/50 hover:text-base-content"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-[320px] bg-base-100 rounded-xl border border-base-300 shadow-xl p-1.5 z-50 max-h-[60vh] overflow-y-auto">
          {people.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-base-content/50">
              {isLoading ? t('search.loading') : t('search.empty')}
            </div>
          ) : (
            people.map(p => (
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
