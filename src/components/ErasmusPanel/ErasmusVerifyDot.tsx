import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Paperclip, Sparkles, X, RotateCcw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { compareSyllabiAI, type AIComparisonResult } from '@/api/gemini';
import { buildMendeluText } from '@/api/syllabusTransfer';
import type { StudyPlan } from '@/types/studyPlan';

interface ErasmusVerifyDotProps {
  courseCode: string;
  courseName: string;
  optionId: string;
  plan: StudyPlan;
  rowIndex: number;
}

export function ErasmusVerifyDot({ courseCode, courseName, optionId, plan: _plan, rowIndex }: ErasmusVerifyDotProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number } | null>(null);

  // Store reads
  const erasmusPdfAssignments = useAppStore(s => s.erasmusPdfAssignments);
  const erasmusUploadedPdfs = useAppStore(s => s.erasmusUploadedPdfs);
  const erasmusVerdicts = useAppStore(s => s.erasmusVerdicts);
  const aiResult = useAppStore(s => s.erasmusAiResults[courseCode]) ?? null;
  const erasmusTableBCourses = useAppStore(s => s.erasmusTableBCourses);
  const syllabusCache = useAppStore(s => s.syllabuses.cache);
  const fetchSyllabus = useAppStore(s => s.fetchSyllabus);

  // Store writes
  const addErasmusUploadedPdf = useAppStore(s => s.addErasmusUploadedPdf);
  const removeErasmusUploadedPdf = useAppStore(s => s.removeErasmusUploadedPdf);
  const setErasmusPdfAssignment = useAppStore(s => s.setErasmusPdfAssignment);
  const setErasmusVerdict = useAppStore(s => s.setErasmusVerdict);
  const setErasmusAiResult = useAppStore(s => s.setErasmusAiResult);

  // Local AI state
  const [localStatus, setLocalStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);

  const aiStatus = localStatus !== 'idle' ? localStatus : (aiResult ? 'done' : 'idle');

  // Derived state
  const assignedFilename = erasmusPdfAssignments[courseCode] ?? null;
  const pdfData = assignedFilename ? erasmusUploadedPdfs[assignedFilename] : null;
  const verdict = erasmusVerdicts[courseCode] ?? null;
  const tableBCodes = erasmusTableBCourses[optionId] ?? [];
  const targetBCode = tableBCodes[rowIndex];

  // ── Auto-Approval Logic ───────────────────────────────────────────────────
  const isAutoApproved = targetBCode && (
    targetBCode.toUpperCase().startsWith('EXA-UP') || 
    targetBCode.toUpperCase().startsWith('EXA-')
  );

  // ── Dot color ──────────────────────────────────────────────────────────────
  const dotClass = (() => {
    if (isAutoApproved) return 'bg-success shadow-[0_0_8px_rgba(0,169,110,0.4)]';
    if (!pdfData) return 'bg-base-content/15 hover:bg-base-content/30';
    if (aiStatus === 'loading') return 'bg-primary animate-pulse';
    if (verdict === 'approved') return 'bg-success';
    if (verdict === 'rejected') return 'bg-error';
    return 'bg-primary/60';
  })();

  // ── Verify button label ────────────────────────────────────────────────────
  const verifyLabel = (() => {
    if (!targetBCode) return t('erasmus.verifyDefault');
    const entry = syllabusCache[targetBCode];
    const name = entry?.courseInfo?.courseNameEn ?? entry?.courseInfo?.courseNameCs ?? targetBCode;
    return t('erasmus.verifyWith', { name });
  })();

  // ── Toggle panel ───────────────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < 300 && spaceAbove > spaceBelow) {
        // Render above
        setPanelPos({
          bottom: window.innerHeight - rect.top + 6,
          right: window.innerWidth - rect.right,
          maxHeight: spaceAbove - 12,
        });
      } else {
        // Render below
        setPanelPos({
          top: rect.bottom + 6,
          right: window.innerWidth - rect.right,
          maxHeight: spaceBelow - 12,
        });
      }
    }
    setOpen(prev => !prev);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [open]);

  // ── File handling ──────────────────────────────────────────────────────────
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 15 * 1024 * 1024) { alert('PDF is too large (max 15 MB).'); return; }
    const base64 = await readFileAsBase64(file);
    addErasmusUploadedPdf(file.name, '', base64);
    setErasmusPdfAssignment(courseCode, file.name);
    setLocalStatus('idle');
    setErasmusAiResult(courseCode, null);
    setAiError(null);
  };

  const handleRemovePdf = () => {
    if (!assignedFilename) return;
    setErasmusPdfAssignment(courseCode, null);
    removeErasmusUploadedPdf(assignedFilename);
    setLocalStatus('idle');
    setErasmusAiResult(courseCode, null);
    setAiError(null);
  };

  // ── AI check ───────────────────────────────────────────────────────────────
  const runAICheck = useCallback(async () => {
    if (!pdfData || !targetBCode) return;
    setLocalStatus('loading');
    setAiError(null);
    try {
      await fetchSyllabus(targetBCode);
      
      const freshCache = useAppStore.getState().syllabuses.cache;
      const targetSyl = freshCache[targetBCode];
      const mendeluText = targetSyl ? buildMendeluText(targetSyl) : '';

      const primaryMetadata = {
        credits: 0,
        type: '',
        code: targetBCode,
        name: targetSyl?.courseInfo?.courseNameEn ?? targetSyl?.courseInfo?.courseNameCs ?? targetBCode,
      };
      
      const result = await compareSyllabiAI(mendeluText, primaryMetadata, pdfData.base64);
      
      setErasmusVerdict(courseCode, result.verdict);
      setErasmusAiResult(courseCode, result);
      setLocalStatus('idle');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error');
      setLocalStatus('error');
    }
  }, [pdfData, targetBCode, fetchSyllabus, courseCode, courseName, setErasmusVerdict, setErasmusAiResult]);

  const similarityPct = aiResult ? Math.round(aiResult.similarity * 100) : null;

  // ── Panel content ──────────────────────────────────────────────────────────
  const panelContent = open && panelPos ? createPortal(
    <div
      ref={panelRef}
      style={{ 
        position: 'fixed', 
        top: panelPos.top, 
        bottom: panelPos.bottom,
        right: panelPos.right, 
        maxHeight: panelPos.maxHeight,
        zIndex: 9999 
      }}
      className="bg-base-100 rounded-box p-4 shadow-lg border border-base-300 w-72 flex flex-col gap-3 overflow-y-auto"
    >
      {/* ── Auto-Approved Component (EXA-UP Wildcards) ── */}
      {isAutoApproved && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={13} className="text-success shrink-0" />
            <span className="text-xs font-bold text-success">{t('erasmus.verifyAutoApprovedPercent')}</span>
          </div>
          <p className="text-xs text-base-content/70 italic">
            "{t('erasmus.verifyAutoApprovedInfo')}"
          </p>
        </div>
      )}

      {/* ── State 1: No PDF ── */}
      {!pdfData && !isAutoApproved && (
        <>
          <span className="text-[10px] uppercase tracking-wider font-bold text-base-content/40">
            {t('erasmus.verifyAttachPdf')}
          </span>
          <button
            className="btn btn-outline btn-sm w-full text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('erasmus.verifyChoosePdf')} <span className="text-base-content/40 font-normal ml-1">{t('erasmus.verifyMax15Mb')}</span>
          </button>
        </>
      )}

      {/* ── States 2–4: PDF attached ── */}
      {pdfData && !isAutoApproved && (
        <>
          {/* PDF name row */}
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-primary shrink-0" />
            <span className="text-xs font-medium truncate flex-1" title={assignedFilename ?? ''}>
              {assignedFilename}
            </span>
            <button
              onClick={handleRemovePdf}
              className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/15 hover:text-error hover:bg-error/10 rounded-full shrink-0"
              title="Remove PDF"
            >
              <X size={11} />
            </button>
          </div>

          {/* Analysing */}
          {aiStatus === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-base-content/60">
              <Loader2 size={13} className="animate-spin shrink-0" />
              <span>{t('erasmus.verifyAnalysing')}</span>
            </div>
          )}

          {/* Approved */}
          {aiStatus === 'done' && aiResult?.verdict === 'approved' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-success shrink-0" />
                <span className="text-xs font-bold text-success">{similarityPct}% {t('erasmus.verifyApproved')}</span>
              </div>
              {aiResult.reasoning && (
                <p className="text-xs text-base-content/70 italic">"{aiResult.reasoning}"</p>
              )}
              <div className="flex justify-end">
                <button onClick={runAICheck} className="btn btn-ghost btn-xs text-[10px] gap-1 text-base-content/40">
                  <RotateCcw size={10} /> {t('erasmus.verifyRerun')}
                </button>
              </div>
            </div>
          )}

          {/* Rejected */}
          {aiStatus === 'done' && aiResult?.verdict === 'rejected' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <XCircle size={13} className="text-error shrink-0" />
                <span className="text-xs font-bold text-error">{similarityPct}% {t('erasmus.verifyRejected')}</span>
              </div>
              {aiResult.reasoning && (
                <p className="text-xs text-base-content/70 italic">"{aiResult.reasoning}"</p>
              )}
              {aiResult.mismatches && aiResult.mismatches.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-base-content/40">
                    {t('erasmus.verifyDiscuss')}
                  </span>
                  <ul className="flex flex-col gap-0.5 pl-2">
                    {aiResult.mismatches.map((m, idx) => (
                      <li key={idx} className="text-xs text-base-content/60">
                        <span className="mr-1">·</span>{m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={runAICheck} className="btn btn-ghost btn-xs text-[10px] gap-1 text-base-content/40">
                  <RotateCcw size={10} /> {t('erasmus.verifyRerun')}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {aiStatus === 'error' && aiError && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-error">{aiError}</p>
              <button onClick={runAICheck} className="btn btn-ghost btn-xs text-[10px] gap-1 text-base-content/40">
                <RotateCcw size={10} /> {t('erasmus.verifyRetry')}
              </button>
            </div>
          )}

          {/* Verify button (idle, has target) */}
          {aiStatus === 'idle' && targetBCode && (
            <button className="btn btn-primary btn-sm w-full text-xs gap-1.5" onClick={runAICheck}>
              <Sparkles size={12} />
              {verifyLabel}
            </button>
          )}

          {/* No Table B course mapped yet at this index */}
          {aiStatus === 'idle' && !targetBCode && (
            <p className="text-[10px] text-base-content/40 italic text-center leading-tight">
              {t('erasmus.verifyAddCorresponding', { row: String(rowIndex + 1) })}
            </p>
          )}


          {/* Change PDF */}
          <button
            className="btn btn-ghost btn-xs text-[10px] text-base-content/30 w-full gap-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={10} /> {t('erasmus.verifyChangePdf')}
          </button>
        </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="btn btn-ghost btn-xs w-4 h-4 min-h-0 p-0 rounded-full flex items-center justify-center"
        title={pdfData ? `${assignedFilename} — click for details` : 'Attach syllabus PDF'}
      >
        <span className={`w-2 h-2 rounded-full transition-colors ${dotClass}`} />
      </button>

      {panelContent}
    </>
  );
}
