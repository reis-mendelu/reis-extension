import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { useViewer, viewerFrom } from '../useViewer';

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
    expect(viewerFrom(null, true)).toMatchObject({ facultyKey: null, erasmus: true });
    expect(viewerFrom('XYZ', false)).toMatchObject({ facultyKey: null, erasmus: false });
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

  it('is the impersonated student while impersonating, never Erasmus', () => {
    useAppStore.setState({
      impersonation: { selection: { faculty: 'FRRMS' }, result: {} } as never,
    });
    const { result } = renderHook(() => useViewer());
    // The picker selects a faculty only, so no programme-level partners then.
    expect(result.current).toEqual({
      facultyKey: 'frrms',
      erasmus: false,
      exchange: false,
      programme: null,
    });
  });
});
