import { Search, X, ArrowLeft } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { injectUserParams } from '../../data/pagesData';
import { useSearch } from './useSearch';
import { SearchResultItem } from './SearchResultItem';
import { SearchFooter } from './SearchFooter';
import type { SearchResult } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { getModifierKey } from '../../utils/platform';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string, faculty?: string) => void;
  actions?: SearchResult[];
}

export function MobileSearchOverlay({ isOpen, onClose, onOpenSubject, actions = [] }: MobileSearchOverlayProps) {
  const { t, language } = useTranslation();
  const [query, setQuery] = useState('');
  const { setIsOpen, selectedIndex, setSelectedIndex, sections, filteredResults, isLoading, recentSearches, studiumId, saveToHistory } = useSearch(query, actions);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'action' && result.onExecute) {
      result.onExecute();
    } else {
      saveToHistory(result);
      if (result.type === 'subject' && onOpenSubject) {
        onOpenSubject(result.subjectCode!, result.title, result.subjectId, result.faculty);
      } else if (result.link) {
        window.open(injectUserParams(result.link, studiumId, language === 'en' ? 'en' : 'cz'), '_blank');
      }

    }
    setQuery('');
    onClose();
  };

  const isEmptyQuery = query.trim() === '';
  const displayResults = isEmptyQuery ? recentSearches : filteredResults;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const resultsCount = displayResults.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % resultsCount); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => prev <= 0 ? resultsCount - 1 : prev - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (resultsCount > 0) handleSelect(displayResults[selectedIndex >= 0 ? selectedIndex : 0]); }
  };

  if (!isOpen) return null;

  const renderSearchResults = () => {
    if (sections.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-sm text-base-content/50">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-base-content/50" />
              <span>{t('search.loading')}</span>
            </div>
          ) : t('search.empty')}
        </div>
      );
    }

    let globalIdx = 0;
    return sections.map(section => (
      <div key={section.key}>
        <div className="px-4 py-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1">
          {section.label}
        </div>
        {section.results.map(result => {
          const idx = globalIdx++;
          return (
            <SearchResultItem key={result.id} result={result} isRecent={false} isSelected={selectedIndex === idx}
              onMouseEnter={() => setSelectedIndex(idx)} onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }} />
          );
        })}
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 bg-base-100 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-base-300">
        <button onClick={onClose} className="p-2 hover:bg-base-200 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex items-center h-10 px-3 bg-base-200 rounded-lg">
          <Search className="w-4 h-4 mr-2 text-base-content/50" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={(() => {
              const modifier = getModifierKey();
              const p = t('search.placeholder', { shortcut: modifier });
              return modifier ? p : p.replace(/\s*\(.*\)$/, '');
            })()}
            className="w-full bg-transparent text-sm text-base-content placeholder-base-content/50 focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="p-1">
              <X className="w-4 h-4 text-base-content/50" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isEmptyQuery ? (
          <>
            <div className="px-4 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider">
              {t('search.recent')}
            </div>
            {recentSearches.length > 0 ? recentSearches.map((result, index) => (
              <SearchResultItem key={result.id} result={result} isRecent isSelected={selectedIndex === index}
                onMouseEnter={() => setSelectedIndex(index)} onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }} />
            )) : (
              <div className="px-4 py-8 text-center text-sm text-base-content/50">
                {t('search.recentHint')}
              </div>
            )}
          </>
        ) : renderSearchResults()}
      </div>
      <SearchFooter />
    </div>
  );
}
