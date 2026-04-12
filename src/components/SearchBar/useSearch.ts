import { useState, useRef, useEffect, useMemo } from 'react';
import { searchGlobal } from '../../api/search';
import { injectUserParams } from '../../data/pagesData';
import { pagesData } from '../../data/pages';
import { pageKeywords } from '../../data/pages/keywords';
import { fuzzyIncludes } from '../../utils/searchUtils';
import type { SearchResult, SearchSection } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { IndexedDBService } from '../../services/storage';
import { useAppStore } from '../../store/useAppStore';

const MAX_RECENT_SEARCHES = 3;

function sortByRelevance(results: SearchResult[], searchQuery: string, studyPlanCodes: Set<string>, userFaculty?: string, userSemester?: string): SearchResult[] {
  return [...results].sort((a, b) => {
    const scoreA = getWithinSectionScore(a, searchQuery, studyPlanCodes, userFaculty, userSemester);
    const scoreB = getWithinSectionScore(b, searchQuery, studyPlanCodes, userFaculty, userSemester);
    return scoreB !== scoreA ? scoreB - scoreA : a.title.localeCompare(b.title);
  });
}

function getWithinSectionScore(r: SearchResult, searchQuery: string, studyPlanCodes: Set<string>, userFaculty?: string, userSemester?: string): number {
  const titleLower = r.title.toLowerCase();
  const codeLower = r.subjectCode?.toLowerCase() ?? '';
  let score = 0;

  // Match quality
  if (titleLower === searchQuery) score += 500;
  else if (titleLower.startsWith(searchQuery)) score += 400;
  else if (codeLower === searchQuery) score += 300;

  // Subject-specific boosts
  if (r.type === 'subject') {
    if (r.id.startsWith('enrolled-')) score += 50;
    if (r.subjectCode && studyPlanCodes.has(r.subjectCode)) score += 30;
    if (r.faculty && userFaculty && r.faculty === userFaculty) score += 20;
    if (r.semester && userSemester && r.semester.includes(userSemester)) score += 10;
  }

  return score;
}

export function useSearch(query: string, actions: SearchResult[] = []) {
  const { t, language } = useTranslation();
  const subjects = useAppStore(s => s.subjects);
  const navPages = useAppStore(s => s.navPages);
  const pages = useMemo(() => {
    if (!navPages) return pagesData;
    const merged = [...navPages];
    const seenIds = new Set(navPages.flatMap(cat => cat.children.map(p => p.id)));
    
    pagesData.forEach(cat => {
      const extra = cat.children.filter(p => !seenIds.has(p.id));
      if (extra.length > 0) {
        const existing = merged.find(c => c.id === cat.id);
        if (existing) existing.children.push(...extra);
        else merged.push({ ...cat, children: [...extra] });
      }
    });
    return merged;
  }, [navPages]);

  const studyPlan = useAppStore(s => s.studyPlanDual);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sections, setSections] = useState<SearchSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const { studiumId, obdobiId, facultyId, userFaculty, userSemester } = useAppStore();
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Flat list for keyboard navigation
  const filteredResults = useMemo(() => sections.flatMap(s => s.results), [sections]);

  useEffect(() => {
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

  // Instant local results (actions + enrolled subjects + pages)
  useEffect(() => {
    if (query.trim().length < 2) {
      setSections([]);
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
    pages.forEach(cat => cat.children.forEach(p => {
      const keywords = pageKeywords[p.id] ?? [];
      const itemLabel = (language === 'en' && p.labelEn) ? p.labelEn : p.label;
      const catLabel = (language === 'en' && cat.labelEn) ? cat.labelEn : cat.label;
      const matchesLabel = fuzzyIncludes(itemLabel, searchQuery);
      const matchesKeyword = keywords.some(kw => kw.toLowerCase().includes(searchQuery));

      if (matchesLabel || matchesKeyword) {
        pageResults.push({
          id: p.id,
          title: itemLabel,
          type: 'page',
          detail: catLabel,
          link: injectUserParams(p.href, studiumId ?? undefined, language === 'en' ? 'en' : 'cz', obdobiId ?? undefined, facultyId ?? undefined)
        });
      }
    }));


    const newSections: SearchSection[] = [
      { key: 'actions', label: t('commands.quickActions'), results: matchedActions },
      { key: 'subjects', label: t('search.subjects'), results: sortByRelevance(enrolledResults, searchQuery, studyPlanCodes, userFaculty, userSemester) },
      { key: 'pages', label: t('search.pages'), results: pageResults },
    ].filter(s => s.results.length > 0);

    setSections(newSections);
    setSelectedIndex(0);
    setIsLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, actions]);

  // Debounced network results (subjects + people) — merge into sections
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

        setSections(prev => {
          const enrolledCodes = new Set(
            prev.find(s => s.key === 'subjects')?.results.filter(r => r.id.startsWith('enrolled-')).map(r => r.subjectCode) ?? []
          );
          const networkSubjects = subjectResults.filter(s => !enrolledCodes.has(s.subjectCode));

          const existingSubjects = prev.find(s => s.key === 'subjects')?.results ?? [];
          const mergedSubjects = sortByRelevance([...existingSubjects, ...networkSubjects], searchQuery, studyPlanCodes, userFaculty, userSemester);

          const newSections: SearchSection[] = [
            prev.find(s => s.key === 'actions'),
            { key: 'subjects', label: t('search.subjects'), results: mergedSubjects },
            prev.find(s => s.key === 'pages'),
            { key: 'people', label: t('search.people'), results: personResults },
          ].filter((s): s is SearchSection => !!s && s.results.length > 0);

          return newSections;
        });
      } catch { /* keep local results */ } finally { setIsLoading(false); }
    }, 250);
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { isOpen, setIsOpen, selectedIndex, setSelectedIndex, sections, filteredResults, isLoading, recentSearches, studiumId, saveToHistory };
}
