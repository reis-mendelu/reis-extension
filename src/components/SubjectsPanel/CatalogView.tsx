import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { searchSubjectsCatalog } from '@/api/search/searchService';
import type { Subject } from '@/api/search/types';
import { computeFailRate } from './computeFailRate';
import { CatalogRow } from './CatalogRow';

const DISPLAY_CAP = 15;
const FETCH_LIMIT = 50;
const DEBOUNCE_MS = 250;

interface Props {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
}

export function CatalogView({ onOpenSubject }: Props) {
  const { t } = useTranslation();
  const successRates = useAppStore(s => s.successRates);
  const userFaculty = useAppStore(s => s.userFaculty);
  const fetchSuccessRateBatch = useAppStore(s => s.fetchSuccessRateBatch);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [minPass, setMinPass] = useState(0);
  const [hideNoData, setHideNoData] = useState(false);
  // Whitelist model: empty set = show all; non-empty = show only listed faculties
  const [selectedFaculties, setSelectedFaculties] = useState<Set<string>>(
    () => new Set(userFaculty ? [userFaculty] : [])
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]); setLoading(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const data = await searchSubjectsCatalog(query.trim(), FETCH_LIMIT);
      setResults(data);
      setLoading(false);
      const codes = data.map(s => s.code).filter(Boolean);
      if (codes.length > 0) fetchSuccessRateBatch(codes);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuccessRateBatch]);

  // Distinct faculties present in current result set, user faculty pinned first
  const facultyChips = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) if (r.faculty && r.faculty !== 'N/A') set.add(r.faculty);
    const list = Array.from(set);
    if (userFaculty && list.includes(userFaculty)) {
      return [userFaculty, ...list.filter(f => f !== userFaculty)];
    }
    return list.sort();
  }, [results, userFaculty]);

  // Enrich with fail rate
  const withRates = useMemo(() => results.map(s => {
    const fail = computeFailRate(successRates[s.code]);
    return { subject: s, failRate: fail };
  }), [results, successRates]);

  // Filter + sort + cap
  const { displayed, filteredCount } = useMemo(() => {
    const showAll = selectedFaculties.size === 0;
    const maxFail = 100 - minPass;
    const filtered = withRates.filter(({ subject, failRate }) => {
      if (!showAll && !selectedFaculties.has(subject.faculty)) return false;
      if (hideNoData && failRate == null) return false;
      if (minPass > 0 && failRate != null && failRate > maxFail) return false;
      return true;
    });
    const sorted = minPass > 0
      ? [...filtered].sort((a, b) => (a.failRate ?? 101) - (b.failRate ?? 101))
      : [...filtered].sort((a, b) => {
          const ua = a.subject.faculty === userFaculty ? 1 : 0;
          const ub = b.subject.faculty === userFaculty ? 1 : 0;
          return ub - ua;
        });
    return { displayed: sorted.slice(0, DISPLAY_CAP), filteredCount: filtered.length };
  }, [withRates, selectedFaculties, hideNoData, minPass, userFaculty]);

  const toggleFaculty = (f: string) => {
    setSelectedFaculties(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="input input-bordered input-sm flex items-center gap-2 focus-within:outline-none focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
        <Search className="w-4 h-4 opacity-50 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('subjects.catalog.placeholder')}
          className="grow text-sm focus:outline-none"
          autoFocus
        />
        {loading && <span className="loading loading-spinner loading-xs text-primary" />}
      </label>

      {query.trim().length < 2 && (
        <p className="text-center text-xs text-base-content/40 py-6">{t('subjects.catalog.hint')}</p>
      )}

      {query.trim().length >= 2 && !loading && results.length === 0 && (
        <p className="text-center text-xs text-base-content/40 py-6">{t('subjects.catalog.noResults')}</p>
      )}

      {results.length > 0 && (
        <>
          {facultyChips.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedFaculties(new Set())}
                className={`btn btn-xs ${selectedFaculties.size === 0 ? 'btn-primary' : 'btn-ghost'}`}
              >
                {t('subjects.catalog.allFaculties')}
              </button>
              {facultyChips.map(f => {
                const active = selectedFaculties.size === 0 || selectedFaculties.has(f);
                return (
                  <button
                    key={f}
                    onClick={() => toggleFaculty(f)}
                    className={`btn btn-xs ${active ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-base-content/40 shrink-0">
              {t('subjects.catalog.minPass')}
            </span>
            <input
              type="range" min={0} max={100} step={5}
              value={minPass}
              onChange={e => setMinPass(Number(e.target.value))}
              className="range range-primary range-xs flex-1"
            />
            <span className="text-xs font-mono tabular-nums w-10 text-right">
              {minPass === 0 ? '—' : `≥${minPass}%`}
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideNoData}
              onChange={e => setHideNoData(e.target.checked)}
              className="checkbox checkbox-xs checkbox-primary"
            />
            <span className="text-xs text-base-content/60">{t('subjects.catalog.hideNoData')}</span>
          </label>

          <div className="flex flex-col rounded-lg border border-base-300 bg-base-100 p-1">
            {displayed.length === 0 ? (
              <p className="text-center text-xs text-base-content/40 py-6">{t('subjects.catalog.noResultsAfterFilter')}</p>
            ) : (
              displayed.map(({ subject, failRate }) => (
                <CatalogRow key={subject.id || subject.code} subject={subject} failRate={failRate} onOpen={onOpenSubject} />
              ))
            )}
          </div>

          <p className="text-[10px] text-base-content/40 text-center">
            {t('subjects.catalog.shownOf', { shown: displayed.length, total: filteredCount })}
          </p>
        </>
      )}
    </div>
  );
}
