import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, FileUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { compareSyllabi, buildMendeluText, type TransferResult } from '@/api/syllabusTransfer';
import { searchSubjects } from '@/api/search/searchService';
import { compareSyllabiAI, type AIComparisonResult, extractSyllabusFromPdf } from '@/api/gemini';
import type { SubjectStatus } from '@/types/studyPlan';
import { toast } from 'sonner';

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
  const uploadedPdfs = useAppStore(s => s.erasmusUploadedPdfs);
  const addUploadedPdf = useAppStore(s => s.addErasmusUploadedPdf);
  const assignedPdfFilename = useAppStore(s => s.erasmusPdfAssignments[subject.code]);

  const hasId = !!subject.id;
  const [foreignText, setForeignText] = useState('');
  const [result, setResult] = useState<TransferResult | (AIComparisonResult & { verdict: 'approved' | 'rejected' }) | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Effective PDF is assigned globally via Row dropdown
  const effectivePdf = assignedPdfFilename ? uploadedPdfs[assignedPdfFilename] : null;

  // No-ID: auto-search for MENDELU equivalent (silent, no UI)
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);

  const syllabusKey = hasId ? subject.code : (selectedSubjectCode ?? '');
  const cachedSyllabus = syllabusCache[syllabusKey];
  const loading = syllabusLoading[syllabusKey] ?? false;
  const autoMendeluText = cachedSyllabus ? buildMendeluText(cachedSyllabus) : '';
  const mendeluReady = autoMendeluText.trim().length >= MIN_CHARS;
  const hasPoolPdfs = Object.keys(uploadedPdfs).length > 0;
  const canSubmit = (foreignText.trim().length >= MIN_CHARS || !!effectivePdf) && mendeluReady && !comparing;

  // Fetch MENDELU syllabus silently
  useEffect(() => {
    if (hasId) fetchSyllabus(subject.code, subject.id);
  }, [hasId, subject.code, subject.id, fetchSyllabus]);

  // Auto-search for no-ID courses silently
  useEffect(() => {
    if (hasId || selectedSubjectCode) return;
    searchSubjects(subject.code.trim()).then(res => {
      if (res.length > 0) {
        setSelectedSubjectCode(res[0].code);
        fetchSyllabus(res[0].code, res[0].id);
      }
    });
  }, [hasId, subject.code, fetchSyllabus, selectedSubjectCode]);

  const runComparison = useCallback(async (mendeluText: string, fText: string, pdfBase64?: string) => {
    if (mendeluText.trim().length < MIN_CHARS) return;
    setComparing(true);
    setError(null);
    setResult(null);
    try {
      // Use Gemini for Platinum comparison (with reasoning)
      // If we have text, we prefer sending just text to save tokens
      if (pdfBase64 || fText.trim().length >= MIN_CHARS) {
        const r = await compareSyllabiAI(
          mendeluText,
          { credits: subject.credits, type: subject.rawStatusText || '', code: subject.code, name: subject.name },
          pdfBase64,
          fText
        );
        setResult(r);
        onVerdict?.(r.verdict);
      } else {
        // Fallback to simple similarity model for short manual text
        const r = await compareSyllabi(mendeluText, fText.trim());
        setResult(r);
        onVerdict?.(r.verdict);
      }
    } catch (err) {
      console.error('[TransferPanel] Comparison failed:', err);
      setError(t('transfer.error'));
    } finally {
      setComparing(false);
    }
  }, [onVerdict, t, subject]);

  // Auto-run comparison when PDF is assigned and Mendelu is ready
  useEffect(() => {
    const autoProcess = async () => {
      if (mendeluReady && effectivePdf && !result && !comparing && !error) {
        let fText = effectivePdf.text;
        
        // Step 1: Extract if text missing
        if (!fText || fText.length < MIN_CHARS) {
          setComparing(true);
          try {
            fText = await extractSyllabusFromPdf(effectivePdf.base64);
            addUploadedPdf(assignedPdfFilename!, fText, effectivePdf.base64);
          } catch (err) {
            console.error('[TransferPanel] Extraction failed:', err);
            setError(t('transfer.extractError'));
            setComparing(false);
            return;
          }
          // After extraction, we need a small delay before comparison to respect RPM
          await new Promise(resolve => setTimeout(resolve, 3100));
        }

        // Step 2: Compare
        runComparison(autoMendeluText, fText);
      }
    };

    autoProcess();
  }, [mendeluReady, assignedPdfFilename, result, comparing, error, autoMendeluText, runComparison]);

  const verdict = result ? ({
    approved: { icon: <CheckCircle2 size={13} className="text-success shrink-0" />, badge: 'badge-success', label: t('transfer.verdictApproved') },
    rejected: { icon: <XCircle size={13} className="text-error shrink-0" />, badge: 'badge-error', label: t('transfer.verdictRejected') },
  }[result.verdict]) : null;

  return (
    <div className={`px-3 flex flex-col gap-2 ${effectivePdf || result || comparing || error ? 'py-3' : ''}`}>
      {/* Loading indicator for MENDELU syllabus — subtle */}
      {loading && !result && !comparing && (
        <span className="text-[9px] text-base-content/30 flex items-center gap-1">
          <Loader2 size={9} className="animate-spin" /> {t('transfer.fetchingSyllabus')}
        </span>
      )}

      {/* Manual text fallback toggle — only if nothing assigned */}
      {!effectivePdf && !result && !manualMode && !comparing && (
        <button
          onClick={() => setManualMode(true)}
          className="btn btn-ghost btn-xs text-base-content/40 hover:text-primary w-full justify-start px-0 font-normal"
        >
          {t('transfer.manualPaste')}
        </button>
      )}

      {/* Textarea — manual mode or showing extracted content */}
      {(manualMode || (effectivePdf && !result && !comparing)) && (
        <div className="relative group">
          <textarea
            autoFocus={manualMode}
            readOnly={!!effectivePdf}
            className="textarea textarea-bordered w-full text-xs leading-relaxed h-20 resize-none transition-all focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 shadow-inner bg-base-200/50"
            placeholder={t('transfer.foreignPlaceholder')}
            value={foreignText || effectivePdf?.text || ''}
            onChange={e => { setForeignText(e.target.value); setResult(null); }}
          />
          {(foreignText || effectivePdf) && (
            <button
              onClick={() => { setForeignText(''); setResult(null); setManualMode(false); }}
              className="absolute top-2 right-2 p-1 rounded-full bg-base-300/50 text-base-content/50 hover:bg-error/20 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <XCircle size={12} />
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {comparing && (
        <div className="flex flex-col items-center justify-center py-4 bg-base-200/30 rounded-xl border border-dashed border-primary/20 animate-pulse">
          <Loader2 size={24} className="animate-spin text-primary mb-2" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">{t('transfer.comparing')}</span>
        </div>
      )}

      {/* Results & actions */}
      {(result || error) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {result && verdict && (
              <div className={`badge ${verdict.badge} badge-xs flex-1 justify-between gap-1 h-auto py-1 shadow-sm`}>
                <div className="flex items-center gap-1">
                  {verdict.icon}
                  <span className="leading-tight font-bold">{verdict.label}</span>
                </div>
                <span className="font-mono text-[9px] opacity-70">
                  {('similarity' in result ? (result.similarity * 100).toFixed(0) : 0)}%
                </span>
              </div>
            )}
            {error && <span className="text-[10px] text-error flex-1 font-bold animate-pulse">{error}</span>}
          </div>

          {/* AI Reasoning Card */}
          {result && 'reasoning' in result && (
            <div className="bg-base-100 rounded-xl p-3 flex flex-col gap-2 border border-base-300 shadow-sm animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-base-content/40 uppercase tracking-widest border-b border-base-200 pb-1.5 mb-0.5">
                <CheckCircle2 size={12} className="text-primary" />
                {t('transfer.aiReasoning')}
              </div>
              <p className="text-[11px] leading-relaxed text-base-content/80 italic font-medium">
                "{result.reasoning}"
              </p>
              {(result.mismatches.length > 0 || !result.creditsMatch || !result.typeMatch) && (
                <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-base-200">
                  {!result.creditsMatch && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-error bg-error/5 p-1.5 rounded-lg border border-error/10">
                      <AlertTriangle size={12} />
                      <span>{t('transfer.lowCredits')}</span>
                    </div>
                  )}
                  {!result.typeMatch && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-error bg-error/5 p-1.5 rounded-lg border border-error/10">
                      <AlertTriangle size={12} />
                      <span>{t('transfer.typeMismatch')}</span>
                    </div>
                  )}
                  {result.mismatches.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-base-content/60 leading-tight">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-base-content/30 shrink-0" />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compare button — only if result not yet ready or manual text entered */}
      {((manualMode && foreignText.trim().length >= MIN_CHARS) || (effectivePdf && error)) && !comparing && !result && (
        <button
          className="btn btn-sm btn-primary w-full shadow-lg shadow-primary/20"
          onClick={() => {
            if (effectivePdf && effectivePdf.text.trim().length >= MIN_CHARS) {
              runComparison(autoMendeluText, effectivePdf.text);
            } else if (effectivePdf) {
              runComparison(autoMendeluText, '', effectivePdf.base64);
            } else {
              runComparison(autoMendeluText, foreignText);
            }
          }}
        >
          {t('transfer.compare')}
        </button>
      )}
    </div>
  );
}
