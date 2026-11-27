import { useAppStore } from '../../../store/useAppStore';

/**
 * Starts or ends a pretend impersonation. Only `impersonation != null` matters
 * to the screens; the selection is there so the banner-shaped readers do not
 * trip. Ending it is its own `setState`: while one is active, the overlay guard
 * strips every overlay key from a write in the same call.
 */
export function setImpersonating(on: boolean) {
  useAppStore.setState({
    impersonation: on ? { selection: { shortCode: 'B-F', year: 1, group: 1 } } : null,
  } as never);
}
