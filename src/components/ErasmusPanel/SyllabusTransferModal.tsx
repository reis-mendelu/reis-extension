import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, XCircle, Search, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { compareSyllabi, buildMendeluText, type TransferResult } from '@/api/syllabusTransfer';
import { searchSubjects } from '@/api/search/searchService';
import type { Subject } from '@/api/search/types';
import type { SubjectStatus } from '@/types/studyPlan';

const MIN_CHARS = 100;

interface Props {
  subject: SubjectStatus;
  onClose: () => void;
}

export function SyllabusTransferModal({ subject, onClose }: Props) {
  const { t } = useTranslation();
  const syllabusCache = useAppStore(s => s.syllabuses.cache);
  const syllabusLoading = useAppStore(s => s.syllabuses.loading);
  const fetchSyllabus = useAppStore(s => s.fetchSyllabus);

  const hasId = !!subject.id;

  // No-ID state: subject search
  const [searchQuery, setSearchQuery] = useState(subject.code);
  const [searchResults, setSearchResults] = useState<Subject[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [foreignText, setForeignText] = useState('');
  const [result, setResult] = useState<TransferResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mendeluExpanded, setMendeluExpanded] = useState(false);

  const foreignRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // For hasId: use store cache
  const cachedSyllabus = syllabusCache[hasId ? subject.code : (selectedSubject?.code ?? '')];
  const loading = syllabusLoading[hasId ? subject.code : (selectedSubject?.code ?? '')] ?? false;

  useEffect(() => {
    if (hasId) fetchSyllabus(subject.code, subject.id);
  }, [subject.code, subject.id, hasId, fetchSyllabus]);

  useEffect(() => { foreignRef.current?.focus(); }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced subject search
  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchSubjects(q.trim()).then(results => {
      setSearchResults(results);
      setDropdownOpen(results.length > 0);
    }).finally(() => setSearching(false));
  }, []);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setSelectedSubject(null);
    setResult(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => runSearch(q), 350);
  };

  const handleSelectSubject = (s: Subject) => {
    setSelectedSubject(s);
    setSearchQuery(`${s.code} — ${s.name}`);
    setDropdownOpen(false);
    setResult(null);
    fetchSyllabus(s.code, s.id);
  };

  // Kick off search for the course code on mount (no-ID case)
  useEffect(() => {
    if (!hasId) runSearch(subject.code);
  }, [hasId, subject.code, runSearch]);

  const autoMendeluText = cachedSyllabus ? buildMendeluText(cachedSyllabus) : '';
  const mendeluReady = autoMendeluText.trim().length >= MIN_CHARS;
  const showMendeluWarning = !loading && cachedSyllabus !== undefined && autoMendeluText.length === 0;
  const canSubmit = foreignText.trim().length >= MIN_CHARS && mendeluReady && !comparing;

  async function handleCompare() {
    if (!canSubmit) return;
    setComparing(true);
    setError(null);
    setResult(null);
    try {
      setResult(await compareSyllabi(autoMendeluText, foreignText.trim()));
    } catch {
      setError(t('transfer.error'));
    } finally {
      setComparing(false);
    }
  }

  const verdictConfig = result ? {
    transferable: {
      icon: <CheckCircle2 size={20} className="text-success" />,
      badge: 'badge-success',
      label: t('transfer.verdictTransferable'),
      note: t('transfer.verdictTransferableNote'),
    },
    borderline: {
      icon: <AlertTriangle size={20} className="text-warning" />,
      badge: 'badge-warning',
      label: t('transfer.verdictBorderline'),
      note: t('transfer.verdictBorderlineNote'),
    },
    unlikely: {
      icon: <XCircle size={20} className="text-error" />,
      badge: 'badge-error',
      label: t('transfer.verdictUnlikely'),
      note: t('transfer.verdictUnlikelyNote'),
    },
  }[result.verdict] : null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base">{t('transfer.title')}</h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              <span className="font-mono">{subject.code}</span>{' · '}{subject.name}
            </p>
          </div>
          {loading && <Loader2 size={14} className="animate-spin text-base-content/30 mt-1 shrink-0" />}
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Subject search (no-ID case) */}
        {!hasId && (
          <div className="flex flex-col gap-1.5" ref={dropdownRef}>
            <label className="text-xs font-medium text-base-content/70">
              {t('transfer.mendeluSearchLabel')}
            </label>
            <div className="relative">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
                <input
                  type="text"
                  className="input input-bordered input-sm w-full pl-8 pr-8 text-xs"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setDropdownOpen(true)}
                  placeholder={t('transfer.mendeluSearchPlaceholder')}
                />
                {searching
                  ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-base-content/30" />
                  : searchResults.length > 0 && (
                    <ChevronDown size={13} className={`absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  )
                }
              </div>

              {dropdownOpen && searchResults.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {searchResults.map(s => (
                    <li key={s.id}>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-base-200 transition-colors flex items-center gap-2"
                        onClick={() => handleSelectSubject(s)}
                      >
                        <span className="font-mono text-[11px] text-base-content/50 shrink-0">{s.code}</span>
                        <span className="text-xs flex-1 truncate">{s.name}</span>
                        <span className="text-[10px] text-base-content/30 shrink-0">{s.semester}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedSubject && (
              <div className="flex items-center gap-2">
                {loading
                  ? <span className="text-[10px] text-base-content/40 flex items-center gap-1"><Loader2 size={10} className="animate-spin" />{t('transfer.fetchingSyllabus')}</span>
                  : mendeluReady
                    ? <span className="text-[10px] text-success">{t('transfer.syllabusReady')} · {autoMendeluText.length} chars</span>
                    : <span className="text-[10px] text-error">{t('transfer.mendeluEmpty')}</span>
                }
              </div>
            )}
          </div>
        )}

        {/* MENDELU auto-fetch failure — hasId case only */}
        {hasId && showMendeluWarning && (
          <div className="border border-error/20 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-base-200/50 transition-colors"
              onClick={() => setMendeluExpanded(e => !e)}
            >
              <span className="flex-1 text-[11px] text-error/70">{t('transfer.mendeluEmpty')}</span>
              <ChevronDown size={12} className={`text-base-content/40 transition-transform ${mendeluExpanded ? 'rotate-180' : ''}`} />
            </button>
            {mendeluExpanded && (
              <p className="px-3 pb-3 text-xs text-base-content/50 border-t border-error/10 pt-2">
                {t('transfer.mendeluEmptyHint')}
              </p>
            )}
          </div>
        )}

        {/* Foreign syllabus — first, auto-focused */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-base-content/70">
            {t('transfer.foreignLabel')}
          </label>
          <textarea
            ref={foreignRef}
            className="textarea textarea-bordered w-full text-xs leading-relaxed resize-none h-40 focus:outline-none focus:border-primary"
            placeholder={t('transfer.foreignPlaceholder')}
            value={foreignText}
            onChange={e => { setForeignText(e.target.value); setResult(null); }}
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-base-content/40">
              {t('transfer.minCharsHint', { min: MIN_CHARS })}
            </span>
            <span className={`text-[10px] tabular-nums ${foreignText.trim().length < MIN_CHARS ? 'text-base-content/30' : 'text-success'}`}>
              {foreignText.trim().length} / {MIN_CHARS}
            </span>
          </div>
        </div>

        {/* Verdict */}
        {result && verdictConfig && (
          <div className="border border-base-300 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {verdictConfig.icon}
              <span className={`badge ${verdictConfig.badge} badge-sm`}>
                {verdictConfig.label}
              </span>
              <span className="text-xs text-base-content/40 ml-auto tabular-nums">
                {(result.similarity * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-base-content/60">{verdictConfig.note}</p>
            <p className="text-[10px] text-base-content/40 italic">{t('transfer.disclaimer')}</p>
          </div>
        )}

        {error && <p className="text-xs text-error">{error}</p>}

        {/* Actions */}
        <div className="modal-action mt-0">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {t('common.close')}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCompare}
            disabled={!canSubmit}
          >
            {comparing
              ? <><Loader2 size={14} className="animate-spin" />{t('transfer.comparing')}</>
              : t('transfer.compare')}
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
