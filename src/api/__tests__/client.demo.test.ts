import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchWithAuth } from '../client';
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
