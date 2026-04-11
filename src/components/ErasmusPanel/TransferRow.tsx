import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ChevronDown, Loader2, CheckCircle2, AlertTriangle, XCircle, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { compareSyllabi, buildMendeluText, type TransferResult } from '@/api/syllabusTransfer';
import { searchSubjects } from '@/api/search/searchService';
import type { Subject } from '@/api/search/types';
import type { SubjectStatus } from '@/types/studyPlan';

const MIN_CHARS = 100;

interface Props {
  subject: SubjectStatus;
  onRemove: () => void;
}

export function TransferRow({ subject, onRemove }: Props) {
  const { t } = useTranslation();
  const syllabusCache = useAppStore(s => s.syllabuses.cache);
  const syllabusLoading = useAppStore(s => s.syllabuses.loading);
  const fetchSyllabus = useAppStore(s => s.fetchSyllabus);

  const hasId = !!subject.id;
  const [expanded, setExpanded] = useState(false);
  const [foreignText, setForeignText] = useState('');
  const [result, setResult] = useState<TransferResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No-ID: subject search state
  const [searchQuery, setSearchQuery] = useState(subject.code);
  const [searchResults, setSearchResults] = useState<Subject[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const syllabusKey = hasId ? subject.code : (selectedSubject?.code ?? '');
  const cachedSyllabus = syllabusCache[syllabusKey];
  const loading = syllabusLoading[syllabusKey] ?? false;
  const autoMendeluText = cachedSyllabus ? buildMendeluText(cachedSyllabus) : '';
  const mendeluReady = autoMendeluText.trim().length >= MIN_CHARS;
  const canSubmit = foreignText.trim().length >= MIN_CHARS && mendeluReady && !comparing;

  useEffect(() => {
    if (expanded && hasId) fetchSyllabus(subject.code, subject.id);
  }, [expanded, hasId, subject.code, subject.id, fetchSyllabus]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchSubjects(q.trim()).then(res => {
      setSearchResults(res); setDropdownOpen(res.length > 0);
    }).finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (expanded && !hasId) runSearch(subject.code);
  }, [expanded, hasId, subject.code, runSearch]);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q); setSelectedSubject(null); setResult(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 350);
  };

  const handleSelectSubject = (s: Subject) => {
    setSelectedSubject(s);
    setSearchQuery(`${s.code} — ${s.name}`);
    setDropdownOpen(false);
    fetchSyllabus(s.code, s.id);
  };

  async function handleCompare() {
    if (!canSubmit) return;
    setComparing(true); setError(null); setResult(null);
    try { setResult(await compareSyllabi(autoMendeluText, foreignText.trim())); }
    catch { setError(t('transfer.error')); }
    finally { setComparing(false); }
  }

  const verdict = result ? ({
    transferable: { icon: <CheckCircle2 size={13} className="text-success shrink-0" />, badge: 'badge-success', label: t('transfer.verdictTransferable') },
    borderline:   { icon: <AlertTriangle  size={13} className="text-warning shrink-0" />, badge: 'badge-warning', label: t('transfer.verdictBorderline') },
    unlikely:     { icon: <XCircle        size={13} className="text-error shrink-0"   />, badge: 'badge-error',   label: t('transfer.verdictUnlikely') },
  }[result.verdict]) : null;

  return (
    <div className={`border-t border-primary/10 first:border-t-0 transition-colors ${expanded ? 'bg-base-200/30' : ''}`}>
      {/* Row */}
      <div className="flex items-center gap-2 py-1.5 px-3 text-xs">
        <span className="font-mono text-base-content/50 shrink-0 w-16 truncate">{subject.code}</span>
        <span className="flex-1 truncate text-base-content/80">{subject.name}</span>
        <span className="text-base-content/40 shrink-0">{subject.credits} {t('erasmus.credits')}</span>
        {result && verdict?.icon}
        <button
          onClick={() => setExpanded(e => !e)}
          className={`btn btn-ghost btn-xs h-6 min-h-0 px-1.5 gap-1 shrink-0 transition-colors ${expanded ? 'text-primary bg-primary/10' : 'text-base-content/40 hover:text-primary'}`}
        >
          <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          <span className="text-[10px]">{t('transfer.checkButton')}</span>
        </button>
        <button onClick={onRemove} className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 shrink-0 text-base-content/20 hover:text-base-content/60">
          <X size={12} />
        </button>
      </div>

      {/* Inline transfer panel */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-primary/10">
          {/* No-ID: subject search dropdown */}
          {!hasId && (
            <div className="relative mt-1" ref={dropdownRef}>
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
              <input
                type="text"
                className="input input-bordered input-xs w-full pl-7 pr-7 text-xs"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setDropdownOpen(true)}
                placeholder={t('transfer.mendeluSearchPlaceholder')}
              />
              {searching
                ? <Loader2 size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-base-content/30" />
                : searchResults.length > 0 && <ChevronDown size={11} className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/30 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              }
              {dropdownOpen && (
                <ul className="absolute z-50 w-full mt-0.5 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {searchResults.map(s => (
                    <li key={s.id}>
                      <button className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-base-200 flex items-center gap-2" onClick={() => handleSelectSubject(s)}>
                        <span className="font-mono text-[10px] text-base-content/50 shrink-0">{s.code}</span>
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-[10px] text-base-content/30 shrink-0">{s.semester}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* MENDELU status */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-base-content/30 uppercase tracking-wide">Mendelu</span>
            {loading
              ? <span className="flex items-center gap-1 text-base-content/40"><Loader2 size={9} className="animate-spin" />{t('transfer.fetchingSyllabus')}</span>
              : mendeluReady
                ? <span className="text-success">{t('transfer.syllabusReady')} · {autoMendeluText.length} ch</span>
                : cachedSyllabus !== undefined
                  ? <span className="text-error/70">{t('transfer.mendeluEmpty')}</span>
                  : <span className="text-base-content/30">—</span>
            }
          </div>

          {/* Foreign textarea */}
          <textarea
            autoFocus
            className="textarea textarea-bordered w-full text-xs leading-relaxed resize-none h-24 focus:outline-none focus:border-primary"
            placeholder={t('transfer.foreignPlaceholder')}
            value={foreignText}
            onChange={e => { setForeignText(e.target.value); setResult(null); }}
          />

          {/* Footer */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] tabular-nums shrink-0 ${foreignText.trim().length < MIN_CHARS ? 'text-base-content/30' : 'text-success'}`}>
              {foreignText.trim().length}/{MIN_CHARS}
            </span>
            {result && verdict && (
              <span className={`badge ${verdict.badge} badge-xs flex-1 justify-start truncate`}>
                {verdict.label} · {(result.similarity * 100).toFixed(0)}%
              </span>
            )}
            {error && <span className="text-[10px] text-error flex-1 truncate">{error}</span>}
            <button className="btn btn-primary btn-xs shrink-0 ml-auto" onClick={handleCompare} disabled={!canSubmit}>
              {comparing ? <Loader2 size={11} className="animate-spin" /> : t('transfer.compare')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
