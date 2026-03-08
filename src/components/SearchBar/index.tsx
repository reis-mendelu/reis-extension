import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { injectUserParams, pagesData } from '../../data/pagesData';
import { useSearch } from './useSearch';
import { SearchResultItem } from './SearchResultItem';
import { SearchFooter } from './SearchFooter';
import type { SearchResult } from './types';
import { useTranslation } from '../../hooks/useTranslation';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string, facultyCode?: string) => void;
  prefillRef?: React.MutableRefObject<((query: string) => void) | null>;
  actions?: SearchResult[];
}

export function SearchBar({ placeholder, onSearch, onOpenSubject, prefillRef, actions = [] }: SearchBarProps) {
  const { t } = useTranslation();
  const defaultPlaceholder = t('search.placeholder');
  const finalPlaceholder = placeholder || defaultPlaceholder;
  const [query, setQuery] = useState('');
  const { isOpen, setIsOpen, selectedIndex, setSelectedIndex, sections, filteredResults, isLoading, recentSearches, studiumId, saveToHistory } = useSearch(query, actions);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (inputWrapRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    const handleParentMessage = (e: MessageEvent) => {
      if (e.data?.type === 'REIS_OPEN_SEARCH') {
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('message', handleParentMessage);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('message', handleParentMessage);
    };
  }, [setIsOpen]);

  // Wire up prefill ref
  useEffect(() => {
    if (!prefillRef) return;
    prefillRef.current = (q: string) => {
      setQuery(q);
      setIsOpen(true);
      inputRef.current?.focus();
    };
    return () => { prefillRef.current = null; };
  }, [prefillRef, setIsOpen]);

  // Track input position for fixed dropdown
  useEffect(() => {
    if (!isOpen || !inputWrapRef.current) { setDropdownPos(null); return; }
    const update = () => {
      const rect = inputWrapRef.current?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isOpen]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'action' && result.onExecute) {
      result.onExecute();
    } else {
      saveToHistory(result);
      if (result.type === 'subject' && onOpenSubject) {
        onOpenSubject(result.subjectCode!, result.title, result.subjectId, result.faculty);
      } else if (result.link) {
        window.open(injectUserParams(result.link, studiumId), '_blank');
      }
      if (onSearch) onSearch(result.title);
    }
    setQuery(''); setIsOpen(false); setSelectedIndex(-1);
  };

  const isEmptyQuery = query.trim() === '';

  const browseItems: SearchResult[] = isEmptyQuery
    ? [
        ...recentSearches,
        ...actions,
        ...pagesData.flatMap(cat => cat.children.map(p => ({ id: p.id, title: p.label, type: 'page' as const, detail: cat.label, link: p.href, category: cat.label }))),
      ]
    : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) { if (e.key === 'Enter' && query.trim() !== '') setIsOpen(true); return; }
    const items = isEmptyQuery ? browseItems : filteredResults;
    const resultsCount = items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % resultsCount); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => prev <= 0 ? resultsCount - 1 : prev - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (resultsCount > 0) handleSelect(items[selectedIndex >= 0 ? selectedIndex : 0]); }
    else if (e.key === 'Escape') { e.preventDefault(); setIsOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  // Render sectioned search results
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
    return sections.map(section => {
      const sectionStartIdx = globalIdx;
      const items = section.results.map((result, _i) => {
        const idx = globalIdx++;
        return (
          <SearchResultItem key={result.id} result={result} isRecent={false} isSelected={selectedIndex === idx}
            onMouseEnter={() => setSelectedIndex(idx)} onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }} />
        );
      });
      return (
        <div key={section.key} data-section-start={sectionStartIdx}>
          <div className="px-4 py-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1 sticky top-0 bg-base-100 z-10">
            {section.label}
          </div>
          {items}
        </div>
      );
    });
  };

  const dropdownContent = isOpen && dropdownPos && (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-150" onMouseDown={() => setIsOpen(false)} />
      <div
        ref={dropdownRef}
        className="fixed z-50 bg-base-100 border border-base-300 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
        style={{ top: dropdownPos.top + 4, left: dropdownPos.left, width: Math.max(dropdownPos.width, 500) }}
      >
        {isEmptyQuery ? (
          <div className="max-h-[min(500px,60vh)] overflow-y-auto pb-2">
            {recentSearches.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1 sticky top-0 bg-base-100 z-10">{t('search.recent')}</div>
                {recentSearches.map((result, index) => (
                  <SearchResultItem key={result.id} result={result} isRecent isSelected={selectedIndex === index}
                    onMouseEnter={() => setSelectedIndex(index)} onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }} />
                ))}
              </div>
            )}
            {actions.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1 sticky top-0 bg-base-100 z-10">{t('commands.quickActions')}</div>
                {actions.map((action, i) => {
                  const globalIdx = recentSearches.length + i;
                  return (
                    <SearchResultItem key={action.id} result={action} isRecent={false} isSelected={selectedIndex === globalIdx}
                      onMouseEnter={() => setSelectedIndex(globalIdx)} onMouseDown={(e) => { e.preventDefault(); handleSelect(action); }} />
                  );
                })}
              </div>
            )}
            {pagesData.map(cat => {
              const catOffset = recentSearches.length + actions.length + pagesData.slice(0, pagesData.indexOf(cat)).reduce((sum, c) => sum + c.children.length, 0);
              return (
                <div key={cat.id}>
                  <div className="px-4 py-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-1 sticky top-0 bg-base-100 z-10">{cat.label}</div>
                  {cat.children.map((p, i) => {
                    const idx = catOffset + i;
                    return (
                      <SearchResultItem key={p.id} result={{ id: p.id, title: p.label, type: 'page', detail: cat.label, link: p.href, category: cat.label }}
                        isRecent={false} isSelected={selectedIndex === idx}
                        onMouseEnter={() => setSelectedIndex(idx)} onMouseDown={(e) => { e.preventDefault(); handleSelect(browseItems[idx]); }} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-h-[min(500px,60vh)] overflow-y-auto pb-2">
            {renderSearchResults()}
          </div>
        )}
        <SearchFooter />
      </div>
    </>
  );

  return (
    <div className="w-full h-full flex items-center">
      <div className="flex-1 max-w-3xl mx-auto flex items-center gap-2">
        <div ref={inputWrapRef} className="relative w-full">
          <div className={`relative flex items-center w-full max-w-3xl bg-base-100 rounded-xl border shadow-sm transition-all duration-200 z-50 ${isOpen ? 'border-primary shadow-[0_0_0_3px_rgba(121,190,21,0.15)]' : 'border-base-300 hover:border-base-content/30'}`}>
            <div className="flex-1 flex items-center h-12 px-4">
              <Search className={`w-5 h-5 mr-3 transition-colors ${isOpen ? 'text-base-content' : 'text-base-content/50'}`} />
              <input ref={inputRef} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)} onKeyDown={handleKeyDown} placeholder={finalPlaceholder}
                className="w-full bg-transparent text-sm text-base-content placeholder-base-content/50 focus:outline-none" />
              {query ? (
                <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="p-1 hover:bg-base-200 rounded-full"><X className="w-4 h-4 text-base-content/50" /></button>
              ) : (
                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-base-content/40 bg-base-200 border border-base-300 rounded">
                  <span className="text-xs">⌘</span>K
                </kbd>
              )}
            </div>
          </div>
          {createPortal(dropdownContent, document.body)}
        </div>
      </div>
    </div>
  );
}
