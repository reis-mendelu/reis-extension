import { useState, useMemo } from 'react';
import { ClipboardList, ShieldCheck, AlertCircle, MapPin, X, Loader2, CheckCircle2, Play } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { extractSyllabusFromPdf, compareSyllabiAI } from '@/api/gemini';
import { buildMendeluText } from '@/api/syllabusTransfer';
import { TransferRow } from './TransferRow';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';
import { toast } from 'sonner';

interface Props {
  plan: StudyPlan;
  selectedCodes: string[];
  onToggle: (code: string) => void;
  compulsoryCredits?: number;
}

export function SelectedCoursesCard({ plan, selectedCodes, onToggle, compulsoryCredits = 0 }: Props) {
  const { t } = useTranslation();
  const pinnedUniversities = useAppStore(s => s.erasmusPinnedUniversities);
  const unpinUniversity = useAppStore(s => s.unpinErasmusUniversity);
  const uploadedPdfs = useAppStore(s => s.erasmusUploadedPdfs);
  const assignedPdfs = useAppStore(s => s.erasmusPdfAssignments);
  const syllabusCache = useAppStore(s => s.syllabuses.cache);
  const setVerdict = useAppStore(s => s.setErasmusVerdict);
  const verdicts = useAppStore(s => s.erasmusVerdicts);

  const [batchComparing, setBatchComparing] = useState(false);

  if (!plan) return null;

  const allSubjects = (plan.blocks || []).flatMap(b => (b.groups || []).flatMap(g => g.subjects || []));
  const selected: SubjectStatus[] = (selectedCodes || [])
    .map(code => allSubjects.find(s => s.code === code))
    .filter((s): s is SubjectStatus => s !== undefined);

  // Courses ready for batch comparison (has assigned PDF and MENDELU syllabus, and not yet verified)
  const readyForBatch = useMemo(() => {
    return selected.filter(s => {
      const assigned = assignedPdfs[s.code];
      const hasPdf = assigned && uploadedPdfs[assigned];
      const hasMendelu = syllabusCache[s.code];
      const notVerified = !verdicts[s.code];
      return hasPdf && hasMendelu && notVerified;
    });
  }, [selected, assignedPdfs, uploadedPdfs, syllabusCache, verdicts]);

  const handleBatchCompare = async () => {
    if (readyForBatch.length === 0) return;
    setBatchComparing(true);
    let successCount = 0;
    try {
      for (const s of readyForBatch) {
        try {
          const mendeluSyllabus = syllabusCache[s.code];
          if (!mendeluSyllabus) continue;
          const mendeluText = buildMendeluText(mendeluSyllabus);
          
          const filename = assignedPdfs[s.code];
          const pdf = uploadedPdfs[filename];
          
          let foreignText = pdf.text;
          
          // Step 1: Extract if text is missing
          if (!foreignText || foreignText.length < 100) {
            toast.loading(`${t('transfer.extracting')}: ${filename}`, { id: `extract-${s.code}` });
            foreignText = await extractSyllabusFromPdf(pdf.base64);
            useAppStore.getState().addErasmusUploadedPdf(filename, foreignText, pdf.base64);
            toast.success(`${t('transfer.extractSuccess')}: ${filename}`, { id: `extract-${s.code}` });
            
            // Short delay to respect RPM after extraction
            await new Promise(resolve => setTimeout(resolve, 3100));
          }
          
          // Step 2: Compare
          const result = await compareSyllabiAI(
            mendeluText,
            { credits: s.credits, type: s.rawStatusText || '', code: s.code, name: s.name },
            undefined, // Always use text now since we just extracted it
            foreignText
          );
          
          setVerdict(s.code, result.verdict);
          successCount++;

          // Respect Gemini quota between different courses
          if (readyForBatch.indexOf(s) < readyForBatch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3100));
          }
        } catch (err) {
          console.error(`[Erasmus] Batch comparison failed for ${s.code}:`, err);
          toast.error(`${t('transfer.error')}: ${s.code}`);
        }
      }
      if (successCount > 0) {
        toast.success(t('transfer.batchVerified', { count: successCount }));
      }
    } finally {
      setBatchComparing(false);
    }
  };

  if (selected.length === 0) {
    return (
      <div className="border border-dashed border-base-300 rounded-lg px-4 py-5 flex flex-col items-center gap-1.5 text-center">
        <ClipboardList size={18} className="text-base-content/20" />
        <p className="text-sm text-base-content/40">{t('erasmus.selectedForLA')}</p>
        <p className="text-xs text-base-content/30">{t('erasmus.studyPlanHint')}</p>
      </div>
    );
  }

  const totalCredits = selected.reduce((sum, s) => sum + s.credits, 0);
  const isMinReached = totalCredits >= 18;
  const isIdeal = totalCredits >= 25;
  const isDangerZone = compulsoryCredits < 10 && selected.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Pinned Universities */}
      {pinnedUniversities.length > 0 && (
        <div className="bg-base-200/50 rounded-xl p-3 border border-base-300">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} className="text-primary shrink-0" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/50">
              {t('erasmus.consideredUniversities')} ({pinnedUniversities.length}/4)
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pinnedUniversities.map(name => (
              <div key={name} className="badge badge-outline badge-sm gap-1.5 h-auto py-1 pr-1">
                <span className="text-[10px] truncate max-w-[180px]">{name}</span>
                <button
                  onClick={() => unpinUniversity(name)}
                  className="hover:text-error transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prolongation Warning */}
      {isDangerZone && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={18} className="text-error shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-error leading-tight">
            {t('erasmus.prolongationWarning')}
          </p>
        </div>
      )}

      <div className={`rounded-xl p-3 border flex items-center justify-between gap-3 ${
        isIdeal ? 'bg-success/5 border-success/20 text-success' :
        isMinReached ? 'bg-warning/5 border-warning-content/20 text-warning-content' :
        'bg-error/5 border-error/20 text-error'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isIdeal ? 'bg-success/20' : isMinReached ? 'bg-warning/20' : 'bg-error/20'
          }`}>
            {isIdeal ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
              {t('erasmus.selectedForLA')}
            </span>
            <span className="text-sm font-bold">
              {isIdeal ? t('erasmus.progressIdeal') : isMinReached ? t('erasmus.progressOk') : t('erasmus.progressLow')}
            </span>
            {compulsoryCredits > 0 && (
              <span className="text-[10px] font-medium opacity-60">
                {t('erasmus.compulsoryCredits')}: {compulsoryCredits} kr.
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-black leading-none">{totalCredits}</span>
          <span className="text-[10px] font-bold block opacity-70 uppercase tracking-tighter">ECTS</span>
        </div>
      </div>

      {/* Batch Compare Button */}
      {readyForBatch.length > 0 && (
        <button
          onClick={handleBatchCompare}
          disabled={batchComparing}
          className="btn btn-primary w-full h-12 flex items-center gap-3 shadow-lg shadow-primary/20 group transition-all"
        >
          {batchComparing
            ? <Loader2 size={20} className="animate-spin" />
            : <Play size={20} className="fill-current group-hover:scale-110 transition-transform" />
          }
          <div className="flex flex-col items-start gap-0.5 text-left text-primary-content">
            <span className="text-xs font-bold uppercase tracking-wide">{t('transfer.compareAll')}</span>
            <span className="text-[10px] font-medium opacity-80">
              {readyForBatch.length} {t('erasmus.selected')}
            </span>
          </div>
        </button>
      )}

      <div className="border border-base-300 bg-base-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3 py-2 bg-base-200/30 border-b border-base-300 flex items-center gap-2">
          <ClipboardList size={14} className="text-base-content/40 shrink-0" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/50">{t('erasmus.selected')} ({selected.length})</span>
        </div>
        <div>
          {selected.map(s => (
            <TransferRow key={s.code} subject={s} onRemove={() => onToggle(s.code)} />
          ))}
        </div>
      </div>
    </div>
  );
}
