import { useState, useRef, useEffect, useMemo } from 'react';
import { fuzzyIncludes } from '../../utils/searchUtils';
import { facultySubjektId } from '../../api/search/facultySubjekt';
import { isEnglishVariantCode, semesterRank } from '../../api/search/subjectVariant';
import type { SearchResult, SearchSection } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

interface RelevanceCtx {
  searchQuery: string;
  studyPlanCodes: Set<string>;
  userFaculty?: string | null;
  userSemester?: string | null;
  isLang: 'cz' | 'en';
}

function sortByRelevance(results: SearchResult[], ctx: RelevanceCtx): SearchResult[] {
  return [...results].sort((a, b) => {
    const scoreA = getWithinSectionScore(a, ctx);
    const scoreB = getWithinSectionScore(b, ctx);
    return scoreB !== scoreA ? scoreB - scoreA : a.title.localeCompare(b.title);
  });
}

function getWithinSectionScore(r: SearchResult, ctx: RelevanceCtx): number {
  const titleLower = r.title.toLowerCase();
  const codeLower = r.subjectCode?.toLowerCase() ?? '';
  let score = 0;

  if (titleLower === ctx.searchQuery) score += 500;
  else if (titleLower.startsWith(ctx.searchQuery)) score += 400;
  else if (codeLower === ctx.searchQuery) score += 300;

  if (r.type === 'subject') {
    if (r.id.startsWith('enrolled-')) score += 50;
    if (r.subjectCode && ctx.studyPlanCodes.has(r.subjectCode)) score += 30;
    if (r.faculty && ctx.userFaculty && r.faculty === ctx.userFaculty) score += 20;
    if (r.semester && ctx.userSemester && r.semester.includes(ctx.userSemester)) score += 10;
    // In EN, students overwhelmingly want the English-taught ("v AJ") variant first.
    if (ctx.isLang === 'en' && r.isEnglishVariant) score += 60;
  }

  return score;
}

/** Keep one result per subject code: enrolled wins, otherwise the latest semester. */
function dedupeByCode(results: SearchResult[]): SearchResult[] {
  const best = new Map<string, SearchResult>();
  const passthrough: SearchResult[] = [];
  for (const r of results) {
    const code = r.subjectCode;
    if (!code) { passthrough.push(r); continue; }
    const cur = best.get(code);
    if (!cur) { best.set(code, r); continue; }
    const curEnrolled = cur.id.startsWith('enrolled-');
    const rEnrolled = r.id.startsWith('enrolled-');
    if (curEnrolled !== rEnrolled) { best.set(code, curEnrolled ? cur : r); continue; }
    best.set(code, semesterRank(r.semester) > semesterRank(cur.semester) ? r : cur);
  }
  return [...best.values(), ...passthrough];
}

export type SearchScope = 'faculty' | 'all';

export function useSearch(query: string, subjectsOnly = false) {
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
            isEnglishVariant: isEnglishVariantCode(code),
          });
        }
      }
    }

    const ctx = { searchQuery, studyPlanCodes, userFaculty, userSemester, isLang };
    const newSections: SearchSection[] = [
      { key: 'subjects', label: t('search.subjects'), results: sortByRelevance(enrolledResults, ctx) },
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

    // Show loading on every (re)fetch — including widening to the whole university,
    // where the query is unchanged so the instant-results effect doesn't re-run.
    setIsLoading(true);
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
          link: s.link, subjectCode: s.code, subjectId: s.id, faculty: s.faculty, semester: s.semester,
          isEnglishVariant: isEnglishVariantCode(s.code),
        }));

        const ctx = { searchQuery, studyPlanCodes, userFaculty, userSemester, isLang };
        setSections(prev => {
          const enrolledCodes = new Set(
            prev.find(s => s.key === 'subjects')?.results.filter(r => r.id.startsWith('enrolled-')).map(r => r.subjectCode) ?? []
          );
          const networkSubjects = subjectResults.filter(s => !enrolledCodes.has(s.subjectCode));
          const existingSubjects = prev.find(s => s.key === 'subjects')?.results ?? [];
          // Collapse same-code rows (e.g. winter + summer of EBC-ST) to one, then rank.
          const mergedSubjects = sortByRelevance(dedupeByCode([...existingSubjects, ...networkSubjects]), ctx);

          const newSections: SearchSection[] = [
            { key: 'subjects', label: t('search.subjects'), results: mergedSubjects },
            ...(subjectsOnly ? [] : [{ key: 'people', label: t('search.people'), results: personResults }]),
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
  const narrowToFaculty = () => setScope('faculty');

  return {
    isOpen, setIsOpen, selectedIndex, setSelectedIndex, sections, filteredResults, isLoading,
    recentSearches, studiumId, saveToHistory,
    scope, canWiden, canScopeToFaculty, widenToUniversity, narrowToFaculty, userFaculty,
  };
}
