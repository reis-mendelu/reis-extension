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

  // Without an identity the demo is not just missing a name: DocsSheet
  // disables every download button on `!studiumId`, so a reviewer taps five
  // live-looking buttons and nothing happens at all.
  it('enterDemo supplies a fabricated student context', async () => {
    await useAppStore.getState().enterDemo();

    const s = useAppStore.getState();
    expect(s.studiumId).toBeTruthy();
    expect(s.studentId).toBeTruthy();
    expect(s.obdobiId).toBeTruthy();
    expect(s.fullName).toBeTruthy();
    expect(s.userFaculty).toBeTruthy();
    expect(s.userSemester).toBeTruthy();
  });

  it('exitDemo clears the fabricated context with the rest of it', async () => {
    await useAppStore.getState().enterDemo();
    await useAppStore.getState().exitDemo();

    const s = useAppStore.getState();
    expect(s.studiumId).toBeNull();
    expect(s.fullName).toBeNull();
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

  it("enterDemo wipes a real student's IS-derived data even in stores the demo never writes", async () => {
    // 'subjects' is never touched by the demo dataset — it's real IS data
    // left behind by an earlier real login. If enterDemo only cleared what
    // it writes, this row would sit under the "Ukázka" banner forever.
    await IndexedDBService.set('subjects', 'current', {
      version: 1,
      lastUpdated: new Date().toISOString(),
      data: {
        REAL101: {
          displayName: 'Skutečný předmět studenta',
          fullName: 'Skutečný předmět studenta',
          subjectCode: 'REAL101',
          folderUrl: '/real-student-folder',
          fetchedAt: new Date().toISOString(),
        },
      },
    });

    await useAppStore.getState().enterDemo();

    expect(await IndexedDBService.get('subjects', 'current')).toBeFalsy();
  });

  it('enterDemo preserves student-authored data that nothing restores', async () => {
    await IndexedDBService.set('custom_events', 'real-event-1', {
      id: 'real-event-1',
      title: 'Skutečná studentova událost',
      date: '2026-09-01',
      startTime: '10:00',
      endTime: '11:00',
    });
    await IndexedDBService.set('meta', 'reis_error_reporting_enabled', false);

    await useAppStore.getState().enterDemo();

    expect(await IndexedDBService.get('custom_events', 'real-event-1')).toBeTruthy();
    expect(await IndexedDBService.get('meta', 'reis_error_reporting_enabled')).toBe(false);
  });
});
