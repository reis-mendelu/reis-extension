import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
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
    useAppStore.setState({
      userFaculty: 'PEF',
      userProgramme: 'B-OI',
      isErasmus: true,
      impersonation: null,
    });
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

  it('is the impersonated student while impersonating, never Erasmus or exchange', () => {
    useAppStore.setState({
      // The admin's own programme must not leak into the impersonated viewer.
      userProgramme: 'Z-EXC',
      impersonation: { selection: { faculty: 'FRRMS' }, result: {} } as never,
    });
    const { result } = renderHook(() => useViewer());
    // A selection without a programme code gives no programme-level matches.
    expect(result.current).toEqual({
      facultyKey: 'frrms',
      erasmus: false,
      exchange: false,
      programme: null,
    });
  });

  // A reis_admin impersonating a B-AII student must see B-AII's links,
  // partners and events, not only the faculty-wide ones.
  it("carries the impersonated student's programme", () => {
    useAppStore.setState({
      impersonation: { selection: { faculty: 'PEF', shortCode: 'B-AII' }, result: {} } as never,
    });
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual({
      facultyKey: 'pef',
      erasmus: false,
      exchange: false,
      programme: 'B-AII',
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
        impersonation: null,
      })
    ).toMatchObject({ programme: 'B-OI' });
  });
});
