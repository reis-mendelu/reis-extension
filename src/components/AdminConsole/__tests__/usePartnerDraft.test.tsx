import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePartnerDraft } from '../usePartnerDraft';
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

  it('marks picked while Partner was on are dropped on switching back to Society', () => {
    const { result } = renderHook(() => usePartnerDraft(undefined));
    act(() => result.current.setKind('partner'));
    act(() => result.current.setLight(new File(['x'], 'm.png', { type: 'image/png' })));
    act(() => result.current.setKind('society'));
    expect(result.current.marks).toEqual({ light: null, dark: null });
  });

  // Released builds without the audience rule restrict a partner's events to
  // its row's faculty, so that faculty must be one the audience names.
  it("a partner's faculty must be one of its audience's faculties", () => {
    const ey = { ...BUNDLED_SOCIETIES.ey!, markLight: 'https://x/ey.png' };
    const { result } = renderHook(() => usePartnerDraft(ey));
    expect(result.current.validate('pef')).toBeNull();
    expect(result.current.validate('mendelu')).toBe('errors.partner_faculty');
    expect(result.current.validate('frrms')).toBe('errors.partner_faculty');
    act(() => result.current.setDraft({ mendelu: '' }));
    expect(result.current.validate('mendelu')).toBeNull();
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
