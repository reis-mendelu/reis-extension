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
const grep = (pattern: string, alsoExclude: string[] = []) => {
  try {
    // The cleanup module names retired keys on purpose; it is the one exception.
    const excludes = ['src/test/guards', 'src/services/cleanup', ...alsoExclude]
      // Double quotes: execSync runs cmd.exe on Windows, where single quotes are literal.
      .map((p) => `":!${p}"`)
      .join(' ');
    return execSync(`git grep -n -E "${pattern}" -- src ${excludes}`, { encoding: 'utf8' });
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

  // Two schedulers. Exam-opening reminders (spec 2026-10-20), and Novinky's rows
  // as notifications, 1:1 (decided with Dominik 2026-11-17): a society event is
  // announced when it appears in Novinky, behind the "Od spolků a MENDELU"
  // switch. That is an announcement, never a reminder before the event: event
  // reminders stay gone, which the second test pins.
  it('no scheduled local notifications besides exam openings and Novinky rows', () => {
    expect(
      grep('LocalNotifications\\.schedule', [
        'src/mobile/examReminders.ts',
        'src/mobile/novinkyNotifications.ts',
      ])
    ).toBe('');
  });

  it('Novinky rows are posted now, never scheduled for later', () => {
    expect(
      execSync(
        'git grep -n -E "schedule: \\{|\\bat:" -- src/mobile/novinkyNotifications.ts || true',
        {
          encoding: 'utf8',
        }
      )
    ).toBe('');
  });

  it('no follow store', () => {
    expect(
      grep('reis_subscribed_associations|toggleFollow|useSpolkySettings|createFollowSlice')
    ).toBe('');
  });
});
