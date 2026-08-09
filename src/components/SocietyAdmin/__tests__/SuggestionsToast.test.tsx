import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { useAppStore } from '../../../store/useAppStore';
import { SuggestionsToast } from '../SuggestionsToast';

const toastInfo = vi.fn();
vi.mock('sonner', () => ({ toast: { info: (...a: unknown[]) => toastInfo(...a) } }));

function sessionFor(email: string): Session {
  return { user: { email } } as unknown as Session;
}

describe('SuggestionsToast', () => {
  beforeEach(() => {
    toastInfo.mockReset();
    useAppStore.setState({
      language: 'en',
      adminSession: null,
      adminRole: null,
      suggestionsUnread: 0,
    });
  });

  it('says nothing to a non-reis_admin (association) session', () => {
    useAppStore.setState({
      adminSession: sessionFor('admin@supef.cz'),
      adminRole: 'association',
      suggestionsUnread: 4,
    });
    render(<SuggestionsToast />);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('says nothing when a reis_admin has no unread', () => {
    useAppStore.setState({
      adminSession: sessionFor('admin@example.com'),
      adminRole: 'reis_admin',
      suggestionsUnread: 0,
    });
    render(<SuggestionsToast />);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('announces the unread count to a reis_admin', () => {
    useAppStore.setState({
      adminSession: sessionFor('admin@example.com'),
      adminRole: 'reis_admin',
      suggestionsUnread: 4,
    });
    render(<SuggestionsToast />);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(String(toastInfo.mock.calls[0]?.[0])).toContain('4');
  });

  it('announces once per admin session, not on every store change', () => {
    useAppStore.setState({
      adminSession: sessionFor('admin@example.com'),
      adminRole: 'reis_admin',
      suggestionsUnread: 4,
    });
    render(<SuggestionsToast />);
    act(() => {
      useAppStore.setState({ suggestionsUnread: 5 });
    });
    expect(toastInfo).toHaveBeenCalledTimes(1);
  });

  it('announces again after a logout/login cycle with unread items', () => {
    useAppStore.setState({
      adminSession: sessionFor('admin@example.com'),
      adminRole: 'reis_admin',
      suggestionsUnread: 4,
    });
    render(<SuggestionsToast />);
    expect(toastInfo).toHaveBeenCalledTimes(1);

    act(() => {
      useAppStore.setState({ adminSession: null, adminRole: null, suggestionsUnread: 0 });
    });
    expect(toastInfo).toHaveBeenCalledTimes(1);

    act(() => {
      useAppStore.setState({
        adminSession: sessionFor('admin@example.com'),
        adminRole: 'reis_admin',
        suggestionsUnread: 2,
      });
    });
    expect(toastInfo).toHaveBeenCalledTimes(2);
    expect(String(toastInfo.mock.calls[1]?.[0])).toContain('2');
  });

  it('renders nothing', () => {
    const { container } = render(<SuggestionsToast />);
    expect(container).toBeEmptyDOMElement();
  });
});
