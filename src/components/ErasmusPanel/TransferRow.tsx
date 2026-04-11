import { useState } from 'react';
import { X, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { buildMendeluText } from '@/api/syllabusTransfer';
import { TransferPanel } from './TransferPanel';
import type { SubjectStatus } from '@/types/studyPlan';

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
  const syllabusCache = useAppStore(s => s.syllabuses.cache);
  const [expanded, setExpanded] = useState(false);
  const [lastVerdict, setLastVerdict] = useState<'approved' | 'rejected' | null>(null);

  const cachedSyllabus = syllabusCache[subject.code];
  const autoMendeluText = cachedSyllabus ? buildMendeluText(cachedSyllabus) : '';

  // TransferPanel calls back via a shared ref pattern isn't feasible across components,
  // so we track verdict state by exposing it from TransferPanel via a prop callback
  void autoMendeluText; // consumed by TransferPanel directly

  return (
    <div className={`border-t border-primary/10 first:border-t-0 transition-colors ${expanded ? 'bg-base-200/30' : ''}`}>
      {/* Row */}
      <div className="flex items-center gap-2 py-1.5 px-3 text-xs">
        <span className="font-mono text-base-content/50 shrink-0 w-16 truncate">{subject.code}</span>
        <span className="flex-1 truncate text-base-content/80">{subject.name}</span>
        <span className="text-base-content/40 shrink-0">{subject.credits} {t('erasmus.credits')}</span>
        {lastVerdict && VERDICT_ICONS[lastVerdict]}
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

      {expanded && <TransferPanel subject={subject} onVerdict={setLastVerdict} />}
    </div>
  );
}
