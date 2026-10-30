import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { WeekBody } from '../WeekBody';
import { trackFeatureSignal } from '../../../../../api/featureUsage';

vi.mock('../../../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));

/**
 * Spec 2026-10-30, decision 15: Týden on screen counts the install once
 * (`trackFeatureSignal` latches per session; the database keeps one row per
 * install per day). Den counts nothing — it is the default, so its number would
 * only be "everyone".
 */
describe('WeekBody — the week view counter', () => {
  beforeEach(() => vi.mocked(trackFeatureSignal).mockClear());

  it('counts the week view when it is shown', () => {
    render(
      <WeekBody
        lessons={[]}
        selectedIso="2026-10-07"
        lessonDates={new Set()}
        nowNext={null}
        onRoute={() => {}}
        onSelectDay={() => {}}
        onOpenDay={() => {}}
        pullSurfaceRef={createRef()}
      />
    );
    expect(trackFeatureSignal).toHaveBeenCalledWith('calendar_week_view');
  });
});
