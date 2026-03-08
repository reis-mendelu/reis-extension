import { useState, useRef, useEffect, useMemo } from 'react';
import { searchGlobal } from '../../api/search';
import { pagesData } from '../../data/pagesData';
import { pageKeywords } from '../../data/pages/keywords';
import { fuzzyIncludes } from '../../utils/searchUtils';
import type { SearchResult } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { IndexedDBService } from '../../services/storage';
import { useAppStore } from '../../store/useAppStore';

const MAX_RECENT_SEARCHES = 3;

export function useSearch(query: string, actions: SearchResult[] = []) {
  const { t, language } = useTranslation();
  const subjects = useAppStore(s => s.subjects);
  const studyPlan = useAppStore(s => s.studyPlanDual);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [studiumId, setStudiumId] = useState<string | undefined>(undefined);
  const [userFaculty, setUserFaculty] = useState<string | undefined>(undefined);
  const [userSemester, setUserSemester] = useState<string | undefined>(undefined);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a set of subject codes from the study plan for ranking boost
  const studyPlanCodes = useMemo(() => {
    const codes = new Set<string>();
    if (!studyPlan) return codes;
    for (const plan of [studyPlan.cz, studyPlan.en]) {
      for (const block of plan.blocks) {
        for (const group of block.groups) {
          for (const subj of group.subjects) {
            if (subj.code) codes.add(subj.code);
          }
        }
      }
    }
    return codes;
  }, [studyPlan]);

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
    const isEnrolled = r.type === 'subject' && r.id.startsWith('enrolled-');
    const inStudyPlan = r.type === 'subject' && r.subjectCode ? studyPlanCodes.has(r.subjectCode) : false;

    // Type tier (tiebreaker within same match quality)
    let base = r.type === 'action' ? 90 : isEnrolled ? 50 : r.type === 'subject' ? 40 : r.type === 'page' ? 20 : 10;

    if (r.type === 'subject') {
      if (inStudyPlan) base += 8;
      if (r.faculty && userFaculty && r.faculty === userFaculty) base += 5;
      if (r.semester && userSemester && r.semester.includes(userSemester)) base += 3;
    }

    // Match quality dominates
    if (titleLower === searchQuery) return 5000 + base;
    if (titleLower.startsWith(searchQuery)) return 4000 + base;
    if (codeLower === searchQuery) return 3000 + base;
    return base;
  };

  const sortResults = (results: SearchResult[], searchQuery: string) =>
    results.sort((a, b) => {
      const sB = getScore(b, searchQuery), sA = getScore(a, searchQuery);
      return sB !== sA ? sB - sA : a.title.localeCompare(b.title);
    });

  // Instant local results (actions + enrolled subjects + pages) — no debounce, no network
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

    const enrolledResults: SearchResult[] = [];
    if (subjects?.data) {
      for (const [code, info] of Object.entries(subjects.data)) {
        const name = language === 'en' ? (info.nameEn || info.displayName) : (info.nameCs || info.displayName);
        const targets = [name, info.displayName, code, info.nameCs, info.nameEn].filter(Boolean) as string[];
        if (targets.some(target => fuzzyIncludes(target, searchQuery))) {
          enrolledResults.push({
            id: `enrolled-${code}`,
            title: name,
            type: 'subject',
            detail: code,
            subjectCode: code,
            subjectId: info.subjectId,
          });
        }
      }
    }

    const pageResults: SearchResult[] = [];
    pagesData.forEach(cat => cat.children.forEach(p => {
      const keywords = pageKeywords[p.id] ?? [];
      const matchesLabel = fuzzyIncludes(p.label, searchQuery);
      const matchesKeyword = keywords.some(kw => kw.toLowerCase().includes(searchQuery));
      if (matchesLabel || matchesKeyword) {
        pageResults.push({ id: p.id, title: p.label, type: 'page', detail: cat.label, link: p.href, category: cat.label });
      }
    }));

    setFilteredResults(sortResults([...matchedActions, ...enrolledResults, ...pageResults], searchQuery));
    setSelectedIndex(0);
    setIsLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, actions]);

  // Debounced network results (subjects + people) — appended to local results
  useEffect(() => {
    if (query.trim().length < 2) return;

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      try {
        const searchQuery = query.toLowerCase();
        const { people, subjects: searchSubjects } = await searchGlobal(query);

        const personResults: SearchResult[] = people.map((p, i) => ({
          id: p.id || `unknown-${i}`, title: p.name, type: 'person',
          detail: p.type === 'student' ? t('search.student') : p.type === 'teacher' ? t('search.teacher') : t('search.employee'),
          link: p.link, personType: p.type
        }));

        const subjectResults: SearchResult[] = searchSubjects.map(s => ({
          id: `subject-${s.id}`, title: s.name, type: 'subject',
          detail: [s.code, s.semester, s.faculty].filter(p => p && p !== 'N/A').join(' · '),
          link: s.link, subjectCode: s.code, subjectId: s.id, faculty: s.faculty, semester: s.semester
        }));

        setFilteredResults(prev => {
          const enrolledCodes = new Set(prev.filter(r => r.id.startsWith('enrolled-')).map(r => r.subjectCode));
          const networkSubjects = subjectResults.filter(s => !enrolledCodes.has(s.subjectCode));
          const networkResults = sortResults([...networkSubjects, ...personResults], searchQuery);
          return [...prev, ...networkResults];
        });
      } catch { /* keep local results */ } finally { setIsLoading(false); }
    }, 250);
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { isOpen, setIsOpen, selectedIndex, setSelectedIndex, filteredResults, isLoading, recentSearches, studiumId, saveToHistory };
}
