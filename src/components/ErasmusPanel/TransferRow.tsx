import { useState, useRef } from 'react';
import { X, CheckCircle2, XCircle, FilePlus, Upload } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { TransferPanel } from './TransferPanel';
import type { SubjectStatus } from '@/types/studyPlan';
import { toast } from 'sonner';

interface Props {
  subject: SubjectStatus;
  onRemove: () => void;
}

const VERDICT_ICONS = {
  approved: <CheckCircle2 size={13} className="text-success shrink-0" />,
  rejected: <XCircle      size={13} className="text-error shrink-0"   />,
} as const;

export function TransferRow({ subject, onRemove }: Props) {
  const { t } = useTranslation();
  const verdict = useAppStore(s => s.erasmusVerdicts[subject.code]) ?? null;
  const setVerdict = useAppStore(s => s.setErasmusVerdict);
  const assignedPdf = useAppStore(s => s.erasmusPdfAssignments[subject.code]);
  const setAssignedPdf = useAppStore(s => s.setErasmusPdfAssignment);
  const addUploadedPdf = useAppStore(s => s.addErasmusUploadedPdf);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVerdict = (v: 'approved' | 'rejected') => setVerdict(subject.code, v);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error(t('transfer.pdfOnly'));
      return;
    }
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    addUploadedPdf(file.name, '', base64);
    setAssignedPdf(subject.code, file.name);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`border-t border-primary/10 first:border-t-0 transition-all relative ${isDragging ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''}`}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 pointer-events-none">
          <Upload size={16} className="text-primary animate-bounce" />
        </div>
      )}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} 
        accept="application/pdf" 
        className="hidden" 
      />

      <div className="flex items-center gap-2 py-2 px-3 text-xs bg-base-200/20">
        <span className="font-mono text-base-content/50 shrink-0 w-16 truncate">{subject.code}</span>
        <span className="flex-1 truncate font-bold text-base-content/80 mr-1">{subject.name}</span>
        
        <span className="text-base-content/40 shrink-0 ml-auto mr-1">{subject.credits} {t('erasmus.credits')}</span>
        
        {verdict && VERDICT_ICONS[verdict]}

        {/* Unified PDF Assignment UI */}
        <div className="flex items-center">
          {!assignedPdf ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-xs h-7 min-h-0 px-2 gap-1.5 shrink-0 transition-all font-bold btn-primary btn-outline hover:btn-primary"
            >
              <Upload size={12} />
              <span className="text-[10px] uppercase tracking-tight">Nahrát PDF</span>
            </button>
          ) : (
            <div 
              className="flex items-center gap-1.5 h-7 px-2 rounded-md transition-all font-bold text-primary bg-primary/10 border border-primary/20"
              title={assignedPdf}
            >
              <FilePlus size={12} />
              <span className="text-[10px] truncate max-w-[100px]">{assignedPdf}</span>
              <button 
                onClick={() => { 
                  setAssignedPdf(subject.code, null); 
                  if (fileInputRef.current) fileInputRef.current.value = ''; 
                }}
                className="ml-0.5 p-0.5 hover:bg-error/20 hover:text-error rounded-full transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <button onClick={onRemove} className="btn btn-ghost btn-xs w-6 h-6 min-h-0 p-0 shrink-0 text-base-content/20 hover:text-error hover:bg-error/10 rounded-full ml-1">
          <X size={14} />
        </button>
      </div>

      <TransferPanel subject={subject} onVerdict={handleVerdict} />
    </div>
  );
}
