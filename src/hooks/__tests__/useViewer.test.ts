import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { overlayWrite } from '../../store/overlay/overlayGuard';
import { useViewer, viewerFrom, viewerOf } from '../useViewer';

describe('viewerFrom', () => {
  it('maps an IS faculty label to a key', () => {
    expect(viewerFrom('PEF', false)).toEqual({
      facultyKey: 'pef',
      erasmus: false,
      exchange: false,
      programme: null,
    });
    expect(viewerFrom('PEF', false, 'B-OI')).toMatchObject({ programme: 'B-OI' });
  });

  it('unknown or missing label is null', () => {
    expect(viewerFrom(null, true)).toEqual({
      facultyKey: null,
      erasmus: true,
      exchange: false,
      programme: null,
    });
    expect(viewerFrom('XYZ', false)).toEqual({
      facultyKey: null,
      erasmus: false,
      exchange: false,
      programme: null,
    });
  });

  // The text test on studium.pl misses Z-EXC when IS is in Czech: the
  // programme is "Zahraniční studenti - krátkodobé studijní pobyty" there.
  it('the exchange programme Z-EXC is Erasmus even when the text test said no', () => {
    expect(viewerFrom('LDF', false, 'Z-EXC')).toMatchObject({ erasmus: true });
    expect(viewerFrom('PEF', false, 'B-EM')).toMatchObject({ erasmus: false });
  });

  // Only the programme code makes an exchange student: the text test can match
  // a Czech student's own Erasmus trip, and `exchange` hides other events.
  it('is an exchange student on Z-EXC only, never on the text test', () => {
    expect(viewerFrom('LDF', false, 'Z-EXC')).toMatchObject({ exchange: true });
    expect(viewerFrom('PEF', true, 'B-OI')).toMatchObject({ exchange: false });
    expect(viewerFrom('PEF', true)).toMatchObject({ exchange: false });
  });
});

describe('useViewer', () => {
  beforeEach(() => {
    // overlayWrite: the identity is guarded while a test leaves an impersonation set.
    useAppStore.setState(
      overlayWrite({
        userFaculty: 'PEF',
        userProgramme: 'B-OI',
        isErasmus: true,
        impersonation: null,
      })
    );
  });

  it('is the signed-in student by default', () => {
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual({
      facultyKey: 'pef',
      erasmus: true,
      exchange: false,
      programme: 'B-OI',
    });
  });

  it('is an exchange student when IS says Z-EXC', () => {
    useAppStore.setState({ userProgramme: 'Z-EXC', isErasmus: false });
    const { result } = renderHook(() => useViewer());
    expect(result.current).toMatchObject({ erasmus: true, exchange: true });
  });

  // The persona is in the store itself (createImpersonationSlice puts it there,
  // design 2026-11-27 §2), so the viewer reads the store and nothing else: an
  // impersonation object alone changes nothing. personaViewer.test.ts drives a
  // real persona through the slice.
  it('reads the store only, never the impersonation selection', () => {
    useAppStore.setState({
      impersonation: { selection: { faculty: 'FRRMS', shortCode: 'B-AII' }, result: {} } as never,
    });
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual({
      facultyKey: 'pef',
      erasmus: true,
      exchange: false,
      programme: 'B-OI',
    });
  });

  // Novinky outside React (buildFeed, src/mobile) reads the same rule.
  it.each([
    ['own', null],
    ['impersonated', { selection: { faculty: 'PEF', shortCode: 'B-AII' }, result: {} }],
  ])('agrees with viewerOf on a store snapshot (%s)', (_, impersonation) => {
    useAppStore.setState({ impersonation: impersonation as never });
    const { result } = renderHook(() => useViewer());
    expect(viewerOf(useAppStore.getState())).toEqual(result.current);
  });
});

describe('viewerOf', () => {
  it('reduces a full programme code to its base, as partner tokens are', () => {
    expect(
      viewerOf({
        userFaculty: 'PEF',
        isErasmus: false,
        userProgramme: 'B-OI-ZBOI',
      })
    ).toMatchObject({ programme: 'B-OI' });
  });
});
