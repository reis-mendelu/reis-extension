import { useState, useCallback } from 'react';
import { certExpiryState } from '../../services/eduroam/certValidity';

/**
 * Where the student's eduroam certificate stands, for `useEduroamSetup`.
 * `expiredAt`: past its notAfter, so setup stops and `renew` is offered.
 * `expiresSoonAt`: within RENEW_WITHIN_DAYS, so setup runs and `renew` is
 * offered alongside — IS does not revoke on regeneration, so early is safe.
 */
export function useCertExpiry() {
  const [expiredAt, setExpiredAt] = useState<Date | null>(null);
  const [expiresSoonAt, setExpiresSoonAt] = useState<Date | null>(null);

  const clear = useCallback(() => {
    setExpiredAt(null);
    setExpiresSoonAt(null);
  }, []);

  /** Records where `expiresAt` stands; true when it has expired and setup must stop. */
  const note = useCallback((expiresAt: Date | null): boolean => {
    const state = certExpiryState(expiresAt, Date.now());
    setExpiredAt(state === 'expired' ? expiresAt : null);
    setExpiresSoonAt(state === 'soon' ? expiresAt : null);
    return state === 'expired';
  }, []);

  return { expiredAt, expiresSoonAt, note, clear };
}
