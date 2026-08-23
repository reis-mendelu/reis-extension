import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import { IndexedDBService } from '../../../services/storage';

describe('createDemoSlice', () => {
  beforeEach(() => {
    useAppStore.setState({ demoMode: false });
  });

  it('defaults to off', () => {
    expect(useAppStore.getState().demoMode).toBe(false);
  });

  it('enterDemo seeds, flags, and marks the handshake done', async () => {
    await useAppStore.getState().enterDemo();

    const s = useAppStore.getState();
    expect(s.demoMode).toBe(true);
    expect(s.syncStatus.handshakeDone).toBe(true);
    expect(await IndexedDBService.get('exams', 'current')).toBeTruthy();
    expect(await IndexedDBService.get('meta', 'study_stats')).toBeTruthy();
  });

  it('exitDemo wipes the seeded data and clears the flag', async () => {
    await useAppStore.getState().enterDemo();
    await useAppStore.getState().exitDemo();

    expect(useAppStore.getState().demoMode).toBe(false);
    expect(await IndexedDBService.get('exams', 'current')).toBeFalsy();
    expect(await IndexedDBService.get('meta', 'study_stats')).toBeFalsy();
  });

  it('exitDemo keeps preferences that share the meta store', async () => {
    await IndexedDBService.set('meta', 'reis_error_reporting_enabled', false);
    await useAppStore.getState().enterDemo();
    await useAppStore.getState().exitDemo();

    expect(await IndexedDBService.get('meta', 'reis_error_reporting_enabled')).toBe(false);
  });
});
