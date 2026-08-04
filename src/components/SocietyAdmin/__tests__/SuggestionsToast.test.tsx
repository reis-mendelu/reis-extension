import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SuggestionsToast } from '../SuggestionsToast';

const toastInfo = vi.fn();
vi.mock('sonner', () => ({ toast: { info: (...a: unknown[]) => toastInfo(...a) } }));

describe('SuggestionsToast', () => {
  beforeEach(() => {
    toastInfo.mockReset();
    useAppStore.setState({ language: 'en', adminRole: null, suggestionsUnread: 0 });
  });

  it('says nothing to a student session', () => {
    useAppStore.setState({ adminRole: null, suggestionsUnread: 4 });
    render(<SuggestionsToast />);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('says nothing when a reis_admin has no unread', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 0 });
    render(<SuggestionsToast />);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('announces the unread count to a reis_admin', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 4 });
    render(<SuggestionsToast />);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(String(toastInfo.mock.calls[0][0])).toContain('4');
  });

  it('announces once per mount, not on every store change', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 4 });
    render(<SuggestionsToast />);
    useAppStore.setState({ suggestionsUnread: 5 });
    expect(toastInfo).toHaveBeenCalledTimes(1);
  });

  it('renders nothing', () => {
    const { container } = render(<SuggestionsToast />);
    expect(container).toBeEmptyDOMElement();
  });
});
