import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SuggestionsInbox } from '../SuggestionsInbox';
import type { SuggestionRow } from '../../../types/suggestions';
import { setPlatform, __resetPlatformForTests } from '../../../platform';
import type { ReisPlatform } from '../../../platform/types';

const row: SuggestionRow = {
  id: 1,
  type: 'bug',
  title: 'Exams empty',
  body: 'Panel stayed empty after enrolling',
  contact: 'student@mendelu.cz',
  screen: 'exams',
  ext_version: '4.0.0',
  browser_name: 'Chrome',
  browser_version: '131',
  viewport: '390x844',
  status: 'new',
  created_at: '2026-08-01T00:00:00.000Z',
};

describe('SuggestionsInbox', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en', suggestions: [], suggestionsUnread: 0 });
  });

  afterEach(() => __resetPlatformForTests());

  it('shows an empty state when there is nothing', () => {
    render(<SuggestionsInbox />);
    expect(screen.getByText(/No suggestions yet/i)).toBeInTheDocument();
  });

  it('renders a suggestion with its screen and contact', () => {
    useAppStore.setState({ suggestions: [row], suggestionsUnread: 1 });
    render(<SuggestionsInbox />);
    expect(screen.getByText('Exams empty')).toBeInTheDocument();
    expect(screen.getByText(/exams/)).toBeInTheDocument();
    expect(screen.getByText('student@mendelu.cz')).toBeInTheDocument();
  });

  // jsdom has no layout, so the wrap itself cannot be asserted here — it was
  // measured in a real browser (title span scrollWidth 1250 → 239 at 320px).
  // This pins the class that makes it possible: without min-w-0 the flex item's
  // default min-width:auto holds it at the width of an unbreakable title and
  // the row scrolls sideways, pushing the type badge off screen.
  it('lets the title shrink so a long unbroken title can wrap', () => {
    useAppStore.setState({ suggestions: [{ ...row, title: 'A'.repeat(120) }] });
    render(<SuggestionsInbox />);
    expect(screen.getByText('A'.repeat(120))).toHaveClass('min-w-0', 'break-words');
  });

  it('marks a suggestion done through the store', () => {
    const updateSuggestionStatus = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ suggestions: [row], suggestionsUnread: 1, updateSuggestionStatus });
    render(<SuggestionsInbox />);
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(updateSuggestionStatus).toHaveBeenCalledWith(1, 'done');
  });

  it('offers a reply that opens a Gmail draft in a new tab', () => {
    useAppStore.setState({ suggestions: [row] });
    render(<SuggestionsInbox />);
    const reply = screen.getByRole('link', { name: /Reply/i });
    expect(reply.getAttribute('href')).toMatch(/^https:\/\/mail\.google\.com\/mail\/\?/);
    expect(reply).toHaveAttribute('target', '_blank');
  });

  it('offers no reply when the contact is not an email', () => {
    useAppStore.setState({ suggestions: [{ ...row, contact: '+420 777 123 456' }] });
    render(<SuggestionsInbox />);
    expect(screen.getByText('+420 777 123 456')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Reply/i })).toBeNull();
  });

  // No target on the native app: a _blank link is intercepted by
  // installExternalLinkHandler, and a mailto: is left to the WebView, which
  // hands it to the phone's mail app.
  it('replies through mailto: in the native app', () => {
    setPlatform({ kind: 'capacitor' } as ReisPlatform);
    useAppStore.setState({ suggestions: [row] });
    render(<SuggestionsInbox />);
    const reply = screen.getByRole('link', { name: /Reply/i });
    expect(reply.getAttribute('href')).toMatch(/^mailto:student@mendelu\.cz\?/);
    expect(reply).not.toHaveAttribute('target');
  });

  it('shows attachment badges from the counts, without loading anything', () => {
    const load = vi.fn();
    useAppStore.setState({
      suggestions: [{ ...row, attachments: { has_screenshot: true, diagnostics_count: 4 } }],
      loadSuggestionAttachments: load,
    });
    render(<SuggestionsInbox />);
    expect(screen.getByText(/screenshot/i)).toBeInTheDocument();
    expect(screen.getByText(/4 entries/i)).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it('offers no attachments button when a report has none', () => {
    useAppStore.setState({ suggestions: [{ ...row, attachments: null }] });
    render(<SuggestionsInbox />);
    expect(screen.queryByRole('button', { name: /Attachments/i })).not.toBeInTheDocument();
  });

  it('loads attachments on demand and shows the screenshot and log', () => {
    const load = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:shot');
    URL.revokeObjectURL = vi.fn();
    useAppStore.setState({
      suggestions: [{ ...row, attachments: { has_screenshot: true, diagnostics_count: 1 } }],
      loadSuggestionAttachments: load,
      suggestionAttachments: {},
    });
    render(<SuggestionsInbox />);
    fireEvent.click(screen.getByRole('button', { name: /Attachments/i }));
    expect(load).toHaveBeenCalledWith(1);

    act(() => useAppStore.setState({
      suggestionAttachments: {
        1: {
          screenshot: new Blob(['j'], { type: 'image/jpeg' }),
          diagnostics: {
            entries: [
              { t: 0, level: 'error', source: 'content', ctx: 'Api.fetchExams', status: 503, msg: 'boom' },
            ],
            env: { platform: 'ios', os: 'iOS 26', lang: 'cz', online: true, uptimeS: 5 },
            sync: {
              lastSync: null,
              isSyncing: false,
              schedule: 'success',
              exams: 'error',
              scheduleCount: 1,
              examsCount: 0,
              examsFetchedAt: null,
            },
          },
        },
      },
    }));
    expect(screen.getByRole('img', { name: /Screenshot from the report/i })).toHaveAttribute(
      'src',
      'blob:shot'
    );
    expect(screen.getByText(/Api.fetchExams/)).toBeInTheDocument();
    expect(screen.getByText(/iOS 26/)).toBeInTheDocument();
  });
});
