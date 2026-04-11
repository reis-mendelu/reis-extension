import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, Loader2, CheckCircle2, XCircle, Search, FileUp, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { compareSyllabi, buildMendeluText, type TransferResult } from '@/api/syllabusTransfer';
import { searchSubjects } from '@/api/search/searchService';
import { extractSyllabusFromPdf, compareSyllabiAI, type AIComparisonResult } from '@/api/gemini';
import type { Subject } from '@/api/search/types';
import type { SubjectStatus } from '@/types/studyPlan';

const MIN_CHARS = 100;

interface Props {
  subject: SubjectStatus;
  onVerdict?: (verdict: 'approved' | 'rejected') => void;
}

export function TransferPanel({ subject, onVerdict }: Props) {
  const { t } = useTranslation();
  const syllabusCache = useAppStore(s => s.syllabuses.cache);
  const syllabusLoading = useAppStore(s => s.syllabuses.loading);
  const fetchSyllabus = useAppStore(s => s.fetchSyllabus);

  const hasId = !!subject.id;
  const [foreignText, setForeignText] = useState('');
  const [result, setResult] = useState<TransferResult | (AIComparisonResult & { verdict: 'approved' | 'rejected' }) | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF Extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState<'success' | 'error' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const canSubmit = (foreignText.trim().length >= MIN_CHARS || extracting) && mendeluReady && !comparing;

  useEffect(() => {
    if (hasId) fetchSyllabus(subject.code, subject.id);
  }, [hasId, subject.code, subject.id, fetchSyllabus]);

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
    if (!hasId) runSearch(subject.code);
  }, [hasId, subject.code, runSearch]);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q); setSelectedSubject(null); setResult(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 350);
  };

  const handleSelectSubject = (s: Subject) => {
    setSelectedSubject(s);
    setSearchQuery(s.name);
    setDropdownOpen(false);
    fetchSyllabus(s.code, s.id);
  };

  const runComparison = useCallback(async (mendeluText: string, fText: string, pdfBase64?: string) => {
    if (mendeluText.trim().length < MIN_CHARS) return;
    
    setComparing(true); 
    setError(null); 
    setResult(null);
    try {
      if (pdfBase64) {
        // Deep AI comparison
        const r = await compareSyllabiAI(
          mendeluText, 
          { 
            credits: subject.credits, 
            type: subject.rawStatusText || '', 
            code: subject.code, 
            name: subject.name 
          }, 
          pdfBase64
        );
        setResult(r);
        onVerdict?.(r.verdict);
      } else {
        // Fast similarity comparison
        const r = await compareSyllabi(mendeluText, fText.trim());
        setResult(r);
        onVerdict?.(r.verdict);
      }
    }
    catch (err) { 
      console.error('[TransferPanel] Comparison failed:', err);
      setError(t('transfer.error')); 
    }
    finally { 
      setComparing(false); 
    }
  }, [onVerdict, t, subject]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setExtractStatus(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]); // remove data:application/pdf;base64,
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      
      const base64 = await base64Promise;
      
      // AUTO-COMPARE directly with PDF if MENDELU is already ready
      if (mendeluReady) {
        await runComparison(autoMendeluText, '', base64);
        setExtractStatus('success');
        // Still extract text for the textarea so user can see it
        const extractedText = await extractSyllabusFromPdf(base64);
        setForeignText(extractedText);
      } else {
        const extractedText = await extractSyllabusFromPdf(base64);
        setForeignText(extractedText);
        setExtractStatus('success');
      }
    } catch (err) {
      console.error('[TransferPanel] Extraction failed:', err);
      setExtractStatus('error');
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  async function handleCompare() {
    runComparison(autoMendeluText, foreignText);
  }

  const verdict = result ? ({
    approved: { icon: <CheckCircle2 size={13} className="text-success shrink-0" />, badge: 'badge-success', label: t('transfer.verdictApproved') },
    rejected: { icon: <XCircle      size={13} className="text-error shrink-0"   />, badge: 'badge-error',   label: t('transfer.verdictRejected') },
  }[result.verdict]) : null;

  return (
    <div className="px-3 pb-3 flex flex-col gap-2 border-t border-primary/10">
      {/* No-ID: subject search dropdown */}
      {!hasId && (
        <div className="relative mt-1" ref={dropdownRef}>
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
          <input
            type="text"
            className="input input-bordered input-xs w-full pl-7 pr-7 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
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
            ? <span className="text-success">{t('transfer.syllabusReady')}</span>
            : cachedSyllabus !== undefined
              ? <span className="text-error/70">{t('transfer.mendeluEmpty')}</span>
              : <span className="text-base-content/30">—</span>
        }
      </div>

      {/* Foreign UI Header */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-base-content/30 uppercase tracking-wide">{t('transfer.foreignLabel')}</span>
        
        <div className="flex items-center gap-2">
          {extracting && (
            <span className="text-[9px] text-primary flex items-center gap-1 animate-pulse">
              <Loader2 size={10} className="animate-spin" />
              {t('transfer.extracting')}
            </span>
          )}
          {extractStatus === 'success' && (
            <span className="text-[9px] text-success flex items-center gap-1 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 size={10} />
              {t('transfer.extractSuccess')}
            </span>
          )}
          {extractStatus === 'error' && (
            <span className="text-[9px] text-error flex items-center gap-1 animate-in shake duration-300">
              <XCircle size={10} />
              {t('transfer.extractError')}
            </span>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="application/pdf"
            className="hidden"
          />
          <button 
            className="btn btn-ghost btn-xs h-6 px-1.5 min-h-0 text-[10px] font-bold gap-1 text-primary hover:bg-primary/10"
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
          >
            <FileUp size={12} />
            {t('transfer.uploadPdf')}
          </button>
        </div>
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {foreignText.trim().length < MIN_CHARS && !result && !comparing && (
            <span className="text-[10px] tabular-nums shrink-0 text-base-content/30">
              {foreignText.trim().length}/{MIN_CHARS}
            </span>
          )}
          {result && verdict && (
            <div className={`badge ${verdict.badge} badge-xs flex-1 justify-between gap-1 h-auto py-1`}>
              <div className="flex items-center gap-1">
                {verdict.icon}
                <span className="leading-tight">{verdict.label}</span>
              </div>
              <span className="font-mono text-[9px] opacity-70">
                {('similarity' in result ? (result.similarity * 100).toFixed(0) : 0)}%
              </span>
            </div>
          )}
          {error && <span className="text-[10px] text-error flex-1 truncate">{error}</span>}
        </div>

        {/* AI Reasoning Card */}
        {result && 'reasoning' in result && (
          <div className="bg-base-200/50 rounded-lg p-2 flex flex-col gap-1.5 border border-base-300 animate-in fade-in slide-in-from-top-1">
            <p className="text-[10px] leading-relaxed text-base-content/70 italic">
              "{result.reasoning}"
            </p>
            
            {(result.mismatches.length > 0 || !result.creditsMatch || !result.typeMatch) && (
              <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-base-300">
                {!result.creditsMatch && (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-error">
                    <AlertTriangle size={10} />
                    <span>Nízký počet kreditů</span>
                  </div>
                )}
                {!result.typeMatch && (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-error">
                    <AlertTriangle size={10} />
                    <span>Nesoulad v ukončení (zkouška vs zápočet)</span>
                  </div>
                )}
                {result.mismatches.map((m, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-base-content/50 leading-tight">
                    <span className="mt-1 w-1 h-1 rounded-full bg-base-content/20 shrink-0" />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-sm w-full" onClick={handleCompare} disabled={!canSubmit || comparing}>
        {comparing ? <Loader2 size={13} className="animate-spin" /> : t('transfer.compare')}
      </button>
      <p className="text-[9px] text-base-content/40 leading-relaxed italic mt-0.5">
        {t('transfer.disclaimer')}
      </p>
    </div>
  );
}
