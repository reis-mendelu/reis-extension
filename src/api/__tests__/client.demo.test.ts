import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth, fetchAuthedBytes } from '../client';
import { DemoModeError } from '../../errors/demoMode';
import { useAppStore } from '../../store/useAppStore';

describe('fetchWithAuth in demo mode', () => {
  beforeEach(() => useAppStore.setState({ demoMode: true }));
  afterEach(() => useAppStore.setState({ demoMode: false }));

  it('throws DemoModeError instead of reaching the network', async () => {
    await expect(fetchWithAuth('https://is.mendelu.cz/auth/')).rejects.toBeInstanceOf(
      DemoModeError
    );
  });
});

describe('fetchAuthedBytes in demo mode', () => {
  beforeEach(() => useAppStore.setState({ demoMode: true }));
  afterEach(() => useAppStore.setState({ demoMode: false }));

  it('throws DemoModeError instead of reaching the network', async () => {
    // The eduroam cert flow (src/api/eduroam.ts) calls this directly for the
    // root cert and the student's user-p12 — a second authenticated path to
    // is.mendelu.cz that fetchWithAuth's guard does not cover.
    await expect(
      fetchAuthedBytes('https://is.mendelu.cz/auth/wifi/certifikat.pl?get=user-p12')
    ).rejects.toBeInstanceOf(DemoModeError);
  });
});
