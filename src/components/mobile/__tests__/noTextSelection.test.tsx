import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../CampusMap/MapCanvas', () => ({ MapCanvas: () => <div /> }));
vi.mock('../../CampusMap/EventLayer', () => ({ EventLayer: () => <div /> }));
vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu'], isLoading: false }),
}));

import { MobileApp } from '../MobileApp';
import { SearchSheet } from '../sheets/SearchSheet';
import { useAppStore } from '../../../store/useAppStore';

/**
 * The app should not behave like a web page you can drag-select.
 *
 * On iOS a long press inside a WKWebView raises the selection handles and the
 * Copy/Look Up callout over whatever was pressed, which on a tap-driven UI is
 * something the student triggers by accident rather than on purpose — a slow
 * tap on a subject row is a long press. Reported simply as "copying text
 * shouldn't be possible".
 *
 * Fields stay selectable: the exception is where typing and editing live, and
 * `user-select: none` inherited into an input takes caret placement with it.
 */
describe('text selection in the phone app', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'calendar',
      mobileSheets: [],
      welcomeSeen: true,
      demoMode: false,
      keyboardOpen: false,
      recentPeople: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });

  it('turns selection off for the app shell', () => {
    render(<MobileApp />);
    expect(screen.getByTestId('mobile-app').className).toContain('select-none');
  });

  it('suppresses the iOS long-press callout as well', () => {
    // user-select alone does not stop the Copy/Look Up bubble in a WKWebView.
    render(<MobileApp />);
    expect(screen.getByTestId('mobile-app').className).toContain('touch-callout');
  });

  it('leaves the search field selectable, so typing still works', () => {
    render(<SearchSheet onClose={() => {}} />);
    expect(screen.getByLabelText('Hledej člověka…').className).toContain('select-text');
  });
});
