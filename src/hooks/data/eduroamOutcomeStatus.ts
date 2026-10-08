import type { EduroamConfigOutcome } from '../../mobile/configureEduroam';

/**
 * Where `useEduroamSetup` lands after the OS answered on the native path. Split
 * out of the hook to keep it under the 200-line convention; behaviour is
 * unchanged.
 *
 * Dismissing Android's dialog is a choice, not a fault: go back to idle so the
 * button is simply offered again, with no error banner. `stale-association`
 * and `renewal-blocked` join `failed` in the error state (#261): iOS installed
 * nothing, so they must not land on the done branch — that is the bug. The copy
 * differs, driven off `outcome`, not off status.
 */
export function statusAfterNativeOutcome(result: EduroamConfigOutcome): 'idle' | 'error' | 'done' {
  if (result === 'cancelled') return 'idle';
  if (result === 'failed' || result === 'stale-association' || result === 'renewal-blocked') {
    return 'error';
  }
  return 'done';
}
