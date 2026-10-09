import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { useViewer, viewerFrom } from '../useViewer';

describe('viewerFrom', () => {
  it('maps an IS faculty label to a key', () => {
    expect(viewerFrom('PEF', false)).toEqual({
      facultyKey: 'pef',
      erasmus: false,
      programme: null,
    });
    expect(viewerFrom('PEF', false, 'B-OI')).toMatchObject({ programme: 'B-OI' });
  });

  it('unknown or missing label is null', () => {
    expect(viewerFrom(null, true)).toEqual({ facultyKey: null, erasmus: true, programme: null });
    expect(viewerFrom('XYZ', false)).toEqual({ facultyKey: null, erasmus: false, programme: null });
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
    expect(result.current).toEqual({ facultyKey: 'pef', erasmus: true, programme: 'B-OI' });
  });

  it('is the impersonated student while impersonating, never Erasmus', () => {
    useAppStore.setState({
      impersonation: { selection: { faculty: 'FRRMS' }, result: {} } as never,
    });
    const { result } = renderHook(() => useViewer());
    // The picker selects a faculty only, so no programme-level partners then.
    expect(result.current).toEqual({ facultyKey: 'frrms', erasmus: false, programme: null });
  });
});
