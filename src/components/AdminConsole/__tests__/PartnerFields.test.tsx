import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePartnerDraft } from '../PartnerFields';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

// The partner half of the society form (spec 2026-10-09), kept testable
// without rendering the whole form.
describe('usePartnerDraft', () => {
  it('starts from an existing partner', () => {
    const { result } = renderHook(() => usePartnerDraft(BUNDLED_SOCIETIES.ey));
    expect(result.current.kind).toBe('partner');
    expect(result.current.draft).toEqual({ pef: '' });
  });

  it('a society produces no audience and needs nothing more', () => {
    const { result } = renderHook(() => usePartnerDraft(BUNDLED_SOCIETIES.esn));
    expect(result.current.toInput()).toEqual({ kind: 'society', audience: null });
    expect(result.current.validate()).toBeNull();
  });

  it('a partner needs a valid audience and a light mark', () => {
    const { result } = renderHook(() => usePartnerDraft(undefined));
    act(() => result.current.setKind('partner'));
    expect(result.current.validate()).toBe('errors.audience');
    act(() => result.current.setDraft({ pef: 'B-OI' }));
    expect(result.current.validate()).toBe('errors.mark_required');
    act(() => result.current.setLight(new File(['x'], 'm.png', { type: 'image/png' })));
    expect(result.current.validate()).toBeNull();
    expect(result.current.toInput()).toEqual({ kind: 'partner', audience: ['pef:B-OI'] });
    expect(result.current.marks.light).not.toBeNull();
  });

  it('an existing partner with an uploaded mark needs no new one', () => {
    const withMark = { ...BUNDLED_SOCIETIES.ey!, markLight: 'https://x/ey.png' };
    const { result } = renderHook(() => usePartnerDraft(withMark));
    expect(result.current.validate()).toBeNull();
  });

  it('a bad programme code is caught before saving', () => {
    const { result } = renderHook(() => usePartnerDraft(BUNDLED_SOCIETIES.ey));
    act(() => result.current.setDraft({ pef: 'B_OI' }));
    expect(result.current.validate()).toBe('errors.audience');
  });
});
