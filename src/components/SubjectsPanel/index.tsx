import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { computeFailRate } from './computeFailRate';
import { SemesterSection } from './SemesterSection';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { IndexedDBService } from '@/services/storage';
import type { SubjectStatus, Zamerani, SemesterBlock } from '@/types/studyPlan';

const IDB_KEY = 'subjects_open_semesters';

function normalizeZamereniName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^zaměření:\s*/i, '')
    .replace(/^specialization:\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// IS Mendelu sentinel: 999 credits = "uznaný předmět", don't sum.
const isRealCredits = (c: number) => c < 999;

function getSemesterState(block: SemesterBlock): 'past' | 'current' | 'future' {
  const all = block.groups.flatMap(g => g.subjects);
  if (all.length === 0) return 'future';
  const hasEnrolled = all.some(s => s.isEnrolled);
  if (hasEnrolled) return 'current';
  const allFulfilled = all.every(s => s.isFulfilled);
  if (allFulfilled) return 'past';
  const hasFulfilled = all.some(s => s.isFulfilled);
  return hasFulfilled ? 'past' : 'future';
}

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
  onSearchSubject: (name: string) => void;
}

export function SubjectsPanel({ onOpenSubject, onSearchSubject }: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const studyPlanLoaded = useAppStore(s => s.studyPlanLoaded);
  const studyStats = useAppStore(s => s.studyStats);
  const successRates = useAppStore(s => s.successRates);
  const handshakeDone = useAppStore(s => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore(s => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore(s => s.syncStatus.isSyncing);

  // Batch-prefetch success rates for all subjects in the plan
  useEffect(() => {
    if (!plan) return;
    const codes = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code)));
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [plan]);

  // --- Multi-open semester state with IndexedDB persistence ---
  const [openSemesters, setOpenSemesters] = useState<Set<number>>(new Set());
  const [idbLoaded, setIdbLoaded] = useState(false);
  const scrolledRef = useRef(false);
  const currentSemesterRef = useRef<HTMLDivElement | null>(null);

  // Compute current semester indices from plan
  const currentSemesterIndices = useMemo(() => {
    if (!plan) return new Set<number>();
    const indices = new Set<number>();
    plan.blocks.forEach((block, i) => {
      if (getSemesterState(block) === 'current') indices.add(i);
    });
    return indices;
  }, [plan]);

  // Load persisted state from IndexedDB
  useEffect(() => {
    IndexedDBService.get('meta', IDB_KEY)
      .then((stored) => {
        if (Array.isArray(stored) && stored.length > 0) {
          setOpenSemesters(new Set(stored as number[]));
        } else {
          // First visit: auto-open current semester(s)
          setOpenSemesters(currentSemesterIndices);
        }
        setIdbLoaded(true);
      })
      .catch(() => {
        setOpenSemesters(currentSemesterIndices);
        setIdbLoaded(true);
      });
  }, [currentSemesterIndices]);

  // Persist to IndexedDB on change (skip the initial load)
  useEffect(() => {
    if (!idbLoaded) return;
    IndexedDBService.set('meta', IDB_KEY, Array.from(openSemesters)).catch(console.error);
  }, [openSemesters, idbLoaded]);

  // Auto-scroll to the first current semester on initial render
  useEffect(() => {
    if (scrolledRef.current || !idbLoaded || !plan) return;
    if (currentSemesterIndices.size === 0) return;
    scrolledRef.current = true;
    // Defer scroll to allow the DOM to settle after expansion
    requestAnimationFrame(() => {
      currentSemesterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [idbLoaded, plan, currentSemesterIndices]);

  const handleToggle = useCallback((index: number) => {
    setOpenSemesters(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const zamereniLookup = useMemo(() => {
    const map = new Map<string, Zamerani>();
    if (!plan?.zameranis) return map;
    for (const z of plan.zameranis) map.set(normalizeZamereniName(z.name), z);
    return map;
  }, [plan]);

  // Pure reduce over existing data: for each zaměření, count how many of its
  // member subjects are currently enrolled or already fulfilled. Used both by
  // the header progress indicator and the zaměření card.
  const zamereniProgress = useMemo(() => {
    const out = new Map<string, { enrolled: number; fulfilled: number; total: number; touched: boolean }>();
    if (!plan?.zameranis) return out;
    const subjectByCode = new Map<string, { isEnrolled: boolean; isFulfilled: boolean }>();
    for (const b of plan.blocks) for (const g of b.groups) for (const s of g.subjects) {
      subjectByCode.set(s.code, { isEnrolled: s.isEnrolled, isFulfilled: s.isFulfilled });
    }
    for (const z of plan.zameranis) {
      let enrolled = 0, fulfilled = 0;
      for (const m of z.subjects) {
        const hit = subjectByCode.get(m.code);
        if (!hit) continue;
        if (hit.isFulfilled) fulfilled++;
        else if (hit.isEnrolled) enrolled++;
      }
      const touched = enrolled + fulfilled > 0;
      out.set(normalizeZamereniName(z.name), { enrolled, fulfilled, total: z.subjects.length, touched });
    }
    return out;
  }, [plan]);

  const failRates = useMemo(() => {
    const map: Record<string, number | null> = {};
    if (!plan) return map;
    for (const block of plan.blocks) {
      for (const group of block.groups) {
        for (const s of group.subjects) {
          map[s.code] = computeFailRate(successRates[s.code]);
        }
      }
    }
    return map;
  }, [plan, successRates]);

  // Compute total enrolled credits for the header
  const enrolledCredits = useMemo(() => {
    if (!plan) return 0;
    let total = 0;
    for (const block of plan.blocks) {
      for (const group of block.groups) {
        for (const s of group.subjects) {
          if (s.isEnrolled && isRealCredits(s.credits)) total += s.credits;
        }
      }
    }
    return total;
  }, [plan]);

  if (!plan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing) {
      return <SubjectsPanelSkeleton />;
    }
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.noData')}</div>;
  }

  // Determine the first current semester index for the scroll ref
  const firstCurrentIdx = plan.blocks.findIndex((block) => getSemesterState(block) === 'current');

  return (
    <div className="h-full overflow-y-auto">
      <SubjectsPanelHeader
        creditsAcquired={plan.creditsAcquired}
        creditsRequired={plan.creditsRequired}
        studyStats={studyStats}
        plan={plan}
        zameraniProgress={zamereniProgress}
        enrolledCredits={enrolledCredits}
      />

      <div className="px-4 pt-4 pb-4">
        <div className="flex flex-col gap-2">
          {plan.blocks.map((block, bi) => (
            <div key={bi} ref={bi === firstCurrentIdx ? currentSemesterRef : undefined}>
              <SemesterSection
                block={block}
                open={openSemesters.has(bi)}
                dimmed={openSemesters.size > 0 && !openSemesters.has(bi)}
                failRates={failRates}
                zamereniLookup={zamereniLookup}
                zamereniProgress={zamereniProgress}
                onToggle={() => handleToggle(bi)}
                onOpenSubject={onOpenSubject}
                onSearchSubject={onSearchSubject}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
