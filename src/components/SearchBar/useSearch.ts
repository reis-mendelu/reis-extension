import { useState, useRef, useEffect } from 'react';
import { searchGlobal } from '../../api/search';
import { pagesData } from '../../data/pagesData';
import { fuzzyIncludes } from '../../utils/searchUtils';
import type { SearchResult } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { IndexedDBService } from '../../services/storage';

const MAX_RECENT_SEARCHES = 5;

export function useSearch(query: string) {
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
        } catch (err) { console.error("Failed to load user params", err); }
    });
    
    const loadRecent = async () => {
        try {
            const stored = await IndexedDBService.get('meta', 'recent_searches');
            if (stored) setRecentSearches(stored);
        } catch { console.error('Failed to load recent searches'); }
    };
    loadRecent();
  }, []);

  const saveToHistory = async (result: SearchResult) => {
    const newItem = { ...result, detail: t('search.recentlySearched') };
    const filtered = recentSearches.filter(item => item.title !== result.title);
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    try {
        await IndexedDBService.set('meta', 'recent_searches', updated);
    } catch {
        console.error('Failed to save recent searches');
    }
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
          const titleLower = r.title.toLowerCase();
          const codeLower = r.subjectCode?.toLowerCase() ?? '';
          const base = r.type === 'subject' ? 1000 : r.type === 'page' ? 500 : 100;
          if (titleLower === searchQuery) return base + 100;
          if (titleLower.startsWith(searchQuery)) return base + 90;
          if (codeLower === searchQuery) return base + 85;
          return base + 10;
        };

        const all = [...subjectResults, ...pageResults, ...personResults].sort((a, b) => {
          const sB = getScore(b), sA = getScore(a);
          return sB !== sA ? sB - sA : a.title.localeCompare(b.title);
        });
        setFilteredResults(all);
      } catch { setFilteredResults([]); } finally { setIsLoading(false); }
    }, 500);
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [query, t]);

  return { isOpen, setIsOpen, selectedIndex, setSelectedIndex, filteredResults, isLoading, recentSearches, studiumId, saveToHistory };
}
