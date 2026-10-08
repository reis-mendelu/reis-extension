import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { useViewer, viewerFrom } from '../useViewer';

describe('viewerFrom', () => {
  it('maps an IS faculty label to a key', () => {
    expect(viewerFrom('PEF', false)).toEqual({ facultyKey: 'pef', erasmus: false });
  });

  it('unknown or missing label is null', () => {
    expect(viewerFrom(null, true)).toEqual({ facultyKey: null, erasmus: true });
    expect(viewerFrom('XYZ', false)).toEqual({ facultyKey: null, erasmus: false });
  });
});

describe('useViewer', () => {
  beforeEach(() => {
    useAppStore.setState({ userFaculty: 'PEF', isErasmus: true, impersonation: null });
  });

  it('is the signed-in student by default', () => {
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual({ facultyKey: 'pef', erasmus: true });
  });

  it('is the impersonated student while impersonating, never Erasmus', () => {
    useAppStore.setState({
      impersonation: { selection: { faculty: 'FRRMS' }, result: {} } as never,
    });
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual({ facultyKey: 'frrms', erasmus: false });
  });
});
