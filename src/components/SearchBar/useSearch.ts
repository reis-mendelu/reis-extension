import { useState, useRef, useEffect } from 'react';
import { searchGlobal } from '../../api/search';
import { pagesData } from '../../data/pagesData';
import { pageKeywords } from '../../data/pages/keywords';
import { fuzzyIncludes } from '../../utils/searchUtils';
import type { SearchResult } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { IndexedDBService } from '../../services/storage';

const MAX_RECENT_SEARCHES = 3;

export function useSearch(query: string, actions: SearchResult[] = []) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [studiumId, setStudiumId] = useState<string | undefined>(undefined);
  const [userFaculty, setUserFaculty] = useState<string | undefined>(undefined);
  const [userSemester, setUserSemester] = useState<string | undefined>(undefined);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    import('../../utils/userParams').then(async ({ getUserParams }) => {
      try {
        const params = await getUserParams();
        if (params?.studium) setStudiumId(String(params.studium));
        if (params?.facultyLabel) setUserFaculty(params.facultyLabel);
        if (params?.periodLabel) setUserSemester(params.periodLabel);
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

  const getScore = (r: SearchResult, searchQuery: string): number => {
    const titleLower = r.title.toLowerCase();
    const codeLower = r.subjectCode?.toLowerCase() ?? '';
    let base = r.type === 'action' ? 10000 : r.type === 'subject' ? 1000 : r.type === 'page' ? 500 : 100;

    if (r.type === 'subject') {
      if (r.faculty && userFaculty && r.faculty === userFaculty) base += 2000;
      if (r.semester && userSemester && r.semester.includes(userSemester)) base += 1000;
    }

    if (titleLower === searchQuery) return base + 500;
    if (titleLower.startsWith(searchQuery)) return base + 400;
    if (codeLower === searchQuery) return base + 300;
    return base + 10;
  };

  const sortResults = (results: SearchResult[], searchQuery: string) =>
    results.sort((a, b) => {
      const sB = getScore(b, searchQuery), sA = getScore(a, searchQuery);
      return sB !== sA ? sB - sA : a.title.localeCompare(b.title);
    });

  // Instant local results (actions + pages) — no debounce, no network
  useEffect(() => {
    if (query.trim().length < 2) {
      setFilteredResults([]);
      setSelectedIndex(-1);
      setIsLoading(false);
      return;
    }

    const searchQuery = query.toLowerCase();

    const matchedActions = actions.filter(a => {
      const targets = [a.title, ...(a.keywords || [])];
      return targets.some(target => fuzzyIncludes(target, searchQuery));
    });

    const pageResults: SearchResult[] = [];
    pagesData.forEach(cat => cat.children.forEach(p => {
      const keywords = pageKeywords[p.id] ?? [];
      const matchesLabel = fuzzyIncludes(p.label, searchQuery);
      const matchesKeyword = keywords.some(kw => kw.toLowerCase().includes(searchQuery));
      if (matchesLabel || matchesKeyword) {
        pageResults.push({ id: p.id, title: p.label, type: 'page', detail: cat.label, link: p.href, category: cat.label });
      }
    }));

    setFilteredResults(sortResults([...matchedActions, ...pageResults], searchQuery));
    setSelectedIndex(0);
    setIsLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, actions]);

  // Debounced network results (subjects + people) — merged on top of local results
  useEffect(() => {
    if (query.trim().length < 2) return;

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
          link: s.link, subjectCode: s.code, subjectId: s.id, faculty: s.faculty, semester: s.semester
        }));

        setFilteredResults(prev => {
          const localResults = prev.filter(r => r.type === 'action' || r.type === 'page');
          return sortResults([...localResults, ...subjectResults, ...personResults], searchQuery);
        });
      } catch { /* keep local results */ } finally { setIsLoading(false); }
    }, 250);
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { isOpen, setIsOpen, selectedIndex, setSelectedIndex, filteredResults, isLoading, recentSearches, studiumId, saveToHistory };
}
