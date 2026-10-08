import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * Society events were reduced on purpose (spec 2026-10-08,
 * docs/superpowers/specs/2026-10-08-society-events-reduction-design.md): no RSVP,
 * no attendee counts, no reminders. Students are shown that an event exists,
 * quietly. A returning RSVP call or a scheduled local notification means someone
 * rebuilt what was removed — read the spec before loosening this.
 *
 * The patterns match comments too: reword a doc comment that names a removed
 * call rather than weakening the guard.
 */
const grep = (pattern: string) => {
  try {
    // The cleanup module names retired keys on purpose; it is the one exception.
    return execSync(
      `git grep -n -E "${pattern}" -- src ':!src/test/guards' ':!src/services/cleanup'`,
      { encoding: 'utf8' }
    );
  } catch (err) {
    // git grep exits 1 when nothing matches — the passing case. Anything else
    // (no git, a bad pattern) must fail loudly, not pass as "no matches".
    if ((err as { status?: number }).status === 1) return '';
    throw err;
  }
};

describe('society events stay reduced', () => {
  it('no RSVP call', () => {
    expect(grep('set_event_rsvp|get_event_rsvps')).toBe('');
  });

  it('no scheduled local notifications', () => {
    expect(grep('LocalNotifications\\.schedule')).toBe('');
  });

  // Seen / Opened / Link (api/eventSignals) replaced them: one unit, once per
  // device. Old builds still send these; current code must not.
  it('no Novinky post counters or per-session map views', () => {
    expect(grep('increment_post_view|increment_post_click|increment_event_map_view')).toBe('');
  });

  it('no follow store', () => {
    expect(
      grep('reis_subscribed_associations|toggleFollow|useSpolkySettings|createFollowSlice')
    ).toBe('');
  });
});
