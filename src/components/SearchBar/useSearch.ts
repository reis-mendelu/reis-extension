import { useState, useRef, useEffect, useMemo } from 'react';
import { fuzzyIncludes } from '../../utils/searchUtils';
import { facultySubjektId } from '../../api/search/facultySubjekt';
import type { SearchResult, SearchSection } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

function sortByRelevance(results: SearchResult[], searchQuery: string, studyPlanCodes: Set<string>, userFaculty?: string | null, userSemester?: string | null): SearchResult[] {
  return [...results].sort((a, b) => {
    const scoreA = getWithinSectionScore(a, searchQuery, studyPlanCodes, userFaculty, userSemester);
    const scoreB = getWithinSectionScore(b, searchQuery, studyPlanCodes, userFaculty, userSemester);
    return scoreB !== scoreA ? scoreB - scoreA : a.title.localeCompare(b.title);
  });
}

function getWithinSectionScore(r: SearchResult, searchQuery: string, studyPlanCodes: Set<string>, userFaculty?: string | null, userSemester?: string | null): number {
  const titleLower = r.title.toLowerCase();
  const codeLower = r.subjectCode?.toLowerCase() ?? '';
  let score = 0;

  if (titleLower === searchQuery) score += 500;
  else if (titleLower.startsWith(searchQuery)) score += 400;
  else if (codeLower === searchQuery) score += 300;

  if (r.type === 'subject') {
    if (r.id.startsWith('enrolled-')) score += 50;
    if (r.subjectCode && studyPlanCodes.has(r.subjectCode)) score += 30;
    if (r.faculty && userFaculty && r.faculty === userFaculty) score += 20;
    if (r.semester && userSemester && r.semester.includes(userSemester)) score += 10;
  }

  return score;
}

export type SearchScope = 'faculty' | 'all';

export function useSearch(query: string) {
  const { t, language } = useTranslation();
  const subjects = useAppStore(s => s.subjects);
  const recentSearches = useAppStore(s => s.recentSearches);
  const saveRecentSearch = useAppStore(s => s.saveRecentSearch);
  const executeSearch = useAppStore(s => s.executeSearch);

  const studyPlan = useAppStore(s => s.studyPlanDual);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sections, setSections] = useState<SearchSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scope, setScope] = useState<SearchScope>('faculty');
  const { studiumId, userFaculty, userSemester } = useAppStore();
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLang: 'cz' | 'en' = language === 'en' ? 'en' : 'cz';
  const facultySubjekt = facultySubjektId(userFaculty);
  // Only meaningful to scope/widen when we actually know the student's faculty.
  const canScopeToFaculty = !!facultySubjekt;
  const effectiveSubjekt = scope === 'faculty' ? facultySubjekt : undefined;
  const canWiden = canScopeToFaculty && scope === 'faculty';

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

  const filteredResults = useMemo(() => sections.flatMap(s => s.results), [sections]);

  const saveToHistory = (result: SearchResult) =>
    saveRecentSearch(result, t('search.recentlySearched'));

  // A fresh query starts from the default (faculty) scope.
  useEffect(() => { setScope('faculty'); }, [query]);

  // Instant local results (enrolled subjects)
  useEffect(() => {
    if (query.trim().length < 2) {
      setSections([]);
      setSelectedIndex(-1);
      setIsLoading(false);
      return;
    }

    const searchQuery = query.toLowerCase();

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

    const newSections: SearchSection[] = [
      { key: 'subjects', label: t('search.subjects'), results: sortByRelevance(enrolledResults, searchQuery, studyPlanCodes, userFaculty, userSemester) },
    ].filter(s => s.results.length > 0);

    setSections(newSections);
    setSelectedIndex(0);
    setIsLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, language]);

  // Debounced network results (subjects + people) — merge into sections.
  // Re-runs when language or scope change so EN names / faculty filter apply immediately.
  useEffect(() => {
    let isMounted = true;
    if (query.trim().length < 2) return () => { isMounted = false; };

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      try {
        const searchQuery = query.toLowerCase();
        const { people, subjects: searchSubjects } = await executeSearch(query, isLang, effectiveSubjekt);

        if (!isMounted) return;

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
            { key: 'subjects', label: t('search.subjects'), results: mergedSubjects },
            { key: 'people', label: t('search.people'), results: personResults },
          ].filter((s): s is SearchSection => !!s && s.results.length > 0);

          return newSections;
        });
      } catch { /* keep local results */ } finally { if (isMounted) setIsLoading(false); }
    }, 250);
    return () => {
      isMounted = false;
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isLang, effectiveSubjekt]);

  const widenToUniversity = () => setScope('all');

  return {
    isOpen, setIsOpen, selectedIndex, setSelectedIndex, sections, filteredResults, isLoading,
    recentSearches, studiumId, saveToHistory,
    scope, canWiden, widenToUniversity, userFaculty,
  };
}
