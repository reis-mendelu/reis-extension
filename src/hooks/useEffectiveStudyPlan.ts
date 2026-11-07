import { useMemo, useState } from 'react';
import { useStudyPlan } from './useStudyPlan';
import { useAppStore } from '../store/useAppStore';
import { buildFallbackPlan } from '../utils/studyPlan/buildFallbackPlan';
import type { StudyPlan } from '../types/studyPlan';

export interface EffectiveStudyPlan {
  /** The real plan when it is usable, else the fallback, else null. */
  plan: StudyPlan | null;
  /** The real plan has at least one subject in it. */
  planUsable: boolean;
  /** `plan` is the subjects-store stand-in, not KontrolaPlanu. */
  isFallback: boolean;
}

/**
 * The study plan to draw, for BOTH trees: the extension's SubjectsPanel and
 * the phone/iPad SubjectsScreen.
 *
 * Erasmus/exchange students have no KontrolaPlanu, so their plan never
 * materializes. They fall back to the subjects store (student/list.pl, the
 * folders their files live in) — see `buildFallbackPlan`. The phone used to
 * have no fallback at all and showed them "No courses yet" (reported 5 Nov 2026).
 *
 * The fallback waits until the plan has settled, or regular students see the
 * exchange caption flash on a cold load: the subjects store (Tier 1) hydrates
 * before the study plan (Tier 2 microtask). "Settled" is: the plan's IndexedDB
 * read has resolved, the handshake has resolved, and no sync is mid-flight —
 * or one sync has already finished this session (`firstSyncSettled`, a latch
 * in the store). The store latch is what keeps an exchange student's list up
 * through the background resyncs that flip `isSyncing` every few minutes, and
 * it survives the phone unmounting the tab, which a component-state latch does
 * not. The component latch stays for the extension, whose panel can see a
 * settled moment before the store records one.
 */
export function useEffectiveStudyPlan(): EffectiveStudyPlan {
  const plan = useStudyPlan();
  const studyPlanLoaded = useAppStore((s) => s.studyPlanLoaded);
  const subjects = useAppStore((s) => s.subjects);
  const language = useAppStore((s) => s.language);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);
  const firstSyncSettled = useAppStore((s) => s.firstSyncSettled);

  const planUsable = !!plan && plan.blocks.some((b) => b.groups.some((g) => g.subjects.length > 0));

  const planSettled =
    studyPlanLoaded && (handshakeDone || handshakeTimedOut) && (!isSyncing || firstSyncSettled);
  const [settledOnce, setSettledOnce] = useState(false);
  if (planSettled && !settledOnce) setSettledOnce(true);
  const gateOpen = planSettled || settledOnce;

  const fallbackPlan = useMemo(() => {
    if (!gateOpen || planUsable || !subjects || Object.keys(subjects.data).length === 0)
      return null;
    // The app's language code is 'cz'; the plan builder takes the locale.
    return buildFallbackPlan(subjects, language === 'en' ? 'en' : 'cs');
  }, [gateOpen, planUsable, subjects, language]);

  if (planUsable) return { plan, planUsable, isFallback: false };
  return { plan: fallbackPlan, planUsable, isFallback: !!fallbackPlan };
}
