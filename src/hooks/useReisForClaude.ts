import { useAppStore } from '../store/useAppStore';
import { isReisForClaudeAudience } from '../utils/reisForClaude';

/**
 * Whether the extension's Novinky shows the "reIS v Claude" row, and what it
 * adds to the bell. Shown to the launch programmes only, until it is opened or
 * dismissed (createReisForClaudeSlice). Extension only: the phone cannot run
 * Claude Desktop (guard: phoneHasNoReisForClaude.test.ts).
 */
export function useReisForClaude(): { visible: boolean; badge: number } {
  const state = useAppStore((s) => s.reisForClaude);
  const programme = useAppStore((s) => s.userProgramme);
  const visible = (state === 'new' || state === 'seen') && isReisForClaudeAudience(programme);
  return { visible, badge: visible && state === 'new' ? 1 : 0 };
}
