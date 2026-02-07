import { useState, useRef, useEffect } from 'react';
import { searchGlobal } from '../../api/search';
import { pagesData } from '../../data/pagesData';
import { fuzzyIncludes } from '../../utils/searchUtils';
import type { SearchResult } from './types';
import { useTranslation } from '../../hooks/useTranslation';

const MAX_RECENT_SEARCHES = 5;
const STORAGE_KEY = 'reis_recent_searches';

export function useSearch(query: string, setQuery: (q: string) => void) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [studiumId, setStudiumId] = useState<string | undefined>(undefined);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    import('../../utils/userParams').then(async ({ getUserParams }) => {
        try {
            const params = await getUserParams();
            if (params?.studium) setStudiumId(String(params.studium));
        } catch (e) { console.error("Failed to load user params", e); }
    });
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (e) { console.error('Failed to load recent searches', e); }
  }, []);

  const saveToHistory = (result: SearchResult) => {
    const newItem = { ...result, detail: t('search.recentlySearched') };
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.title !== result.title);
      const updated = [newItem, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (query.trim().length < 3) {
      setFilteredResults([]);
      setSelectedIndex(-1);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      try {
        const searchQuery = query.toLowerCase();
        const { people, subjects } = await searchGlobal(query);
        
        const personResults: SearchResult[] = people.map((p, i) => ({
          id: p.id || `unknown-${i}`, title: p.name, type: 'person',
          detail: p.type === 'student' ? t('search.student') : p.type === 'teacher' ? t('search.teacher') : t('search.employee'),
          link: p.link, personType: p.type
        }));

        const subjectResults: SearchResult[] = subjects.map(s => ({
          id: `subject-${s.id}`, title: s.name, type: 'subject',
          detail: [s.code, s.semester, s.faculty].filter(p => p && p !== 'N/A').join(' · '),
          link: s.link, subjectCode: s.code, subjectId: s.id
        }));

        const pageResults: SearchResult[] = [];
        pagesData.forEach(cat => cat.children.forEach(p => {
          if (fuzzyIncludes(p.label, searchQuery)) {
            pageResults.push({ id: p.id, title: p.label, type: 'page', detail: cat.label, link: p.href, category: cat.label });
          }
        }));

        const getScore = (r: SearchResult): number => {
          const t = r.title.toLowerCase();
          const c = r.subjectCode?.toLowerCase() ?? '';
          let b = r.type === 'subject' ? 1000 : r.type === 'page' ? 500 : 100;
          if (t === searchQuery) return b + 100;
          if (t.startsWith(searchQuery)) return b + 90;
          if (c === searchQuery) return b + 85;
          return b + 10;
        };

        const all = [...subjectResults, ...pageResults, ...personResults].sort((a, b) => {
          const sB = getScore(b), sA = getScore(a);
          return sB !== sA ? sB - sA : a.title.localeCompare(b.title);
        });
        setFilteredResults(all);
      } catch (e) { setFilteredResults([]); } finally { setIsLoading(false); }
    }, 500);
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [query]);

  return { isOpen, setIsOpen, selectedIndex, setSelectedIndex, filteredResults, isLoading, recentSearches, studiumId, saveToHistory };
}
