import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { injectUserParams } from '../../data/pagesData';
import { useSearch } from './useSearch';
import { SearchResultItem } from './SearchResultItem';
import { SearchFooter } from './SearchFooter';
import type { SearchBarProps, SearchResult } from './types';
import { useTranslation } from '../../hooks/useTranslation';

export function SearchBar({ placeholder, onSearch, onOpenSubject }: SearchBarProps) {
  const { t } = useTranslation();
  const defaultPlaceholder = t('search.placeholder');
  const finalPlaceholder = placeholder || defaultPlaceholder;
  const [query, setQuery] = useState('');
  const { isOpen, setIsOpen, selectedIndex, setSelectedIndex, filteredResults, isLoading, recentSearches, studiumId, saveToHistory } = useSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  const handleSelect = (result: SearchResult) => {
    saveToHistory(result);
    if (result.type === 'subject' && onOpenSubject) {
      onOpenSubject(result.subjectCode!, result.title, result.subjectId);
    } else if (result.link) {
      window.open(injectUserParams(result.link, studiumId), '_blank');
    }
    if (onSearch) onSearch(result.title);
    setQuery(''); setIsOpen(false); setSelectedIndex(-1);
  };

  const displayResults = query.trim() === '' ? recentSearches : filteredResults;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) { if (e.key === 'Enter' && query.trim() !== '') setIsOpen(true); return; }
    const resultsCount = displayResults.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % resultsCount); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => prev <= 0 ? resultsCount - 1 : prev - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (resultsCount > 0) handleSelect(displayResults[selectedIndex >= 0 ? selectedIndex : 0]); }
    else if (e.key === 'Escape') { e.preventDefault(); setIsOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  return (
    <div className="flex-1 flex items-center px-4">
      <div className="flex-1 max-w-3xl mx-auto flex items-center gap-2">
        <div ref={containerRef} className="relative flex-1 z-50">
          <div className={`relative flex items-center w-full max-w-3xl bg-base-100 rounded-xl border shadow-sm transition-all duration-200 ${isOpen ? 'border-primary shadow-[0_0_0_3px_rgba(121,190,21,0.15)]' : 'border-base-300 hover:border-base-content/30'}`}>
            <div className="flex-1 flex items-center h-12 px-4">
              <Search className={`w-5 h-5 mr-3 transition-colors ${isOpen ? 'text-base-content' : 'text-base-content/50'}`} />
              <input ref={inputRef} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                     onFocus={() => query.trim().length > 0 && setIsOpen(true)} onKeyDown={handleKeyDown} placeholder={finalPlaceholder}
                     className="w-full bg-transparent text-sm text-base-content placeholder-base-content/50 focus:outline-none" />
              {query && (<button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="p-1 hover:bg-base-200 rounded-full"><X className="w-4 h-4 text-base-content/50" /></button>)}
            </div>
          </div>
          {isOpen && (
            <div className="absolute top-full left-0 right-0 bg-base-100 border border-t-0 border-base-300 rounded-b-lg shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="h-px w-full bg-base-300" />
              <div className="px-4 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1"><span>{query ? t('search.results') : t('search.recent')}</span></div>
              <div className="max-h-[min(400px,50vh)] overflow-y-auto pb-2">
                {displayResults.length > 0 ? displayResults.map((result, index) => (
                  <SearchResultItem key={result.id} result={result} isRecent={query === ''} isSelected={selectedIndex === index}
                                    onMouseEnter={() => setSelectedIndex(index)} onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }} />
                )) : (
                  <div className="px-4 py-8 text-center text-sm text-base-content/50">
                    {isLoading ? <div className="flex flex-col items-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-base-content/50"></div><span>{t('search.loading')}</span></div> :
                      query.trim() === '' ? <span>{t('search.recentHint')}</span> : t('search.empty')}
                  </div>
                )}
              </div>
              <SearchFooter />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
