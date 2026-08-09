import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'capacitor' })) }));

import { getPlatform } from '../../platform';
import { teamsChatUrl, openTeamsChat } from '../teamsLink';

const mockedGetPlatform = vi.mocked(getPlatform);

describe('teamsChatUrl', () => {
  it('addresses the chat by the person, not by a tenant id we do not have', () => {
    expect(teamsChatUrl('david.prochazka@mendelu.cz')).toBe(
      'https://teams.microsoft.com/l/chat/0/0?users=david.prochazka%40mendelu.cz'
    );
  });

  it('encodes the address so a stray character cannot break out of the query', () => {
    expect(teamsChatUrl('a+b@mendelu.cz')).toContain('users=a%2Bb%40mendelu.cz');
  });

  it("drops IS's mail subdomain, which Microsoft 365 has never heard of", () => {
    // Device-verified on a real handset: IS publishes some students as
    // `xdoupove@node.mendelu.cz` (its own mail host). Handed to Teams verbatim
    // that opens "New chat — Couldn't load chat" with an EMPTY recipient, while
    // `xdoupove@mendelu.cz` opens the chat with the person filled in. The
    // tenant is mendelu.cz; anything under it is the same human.
    expect(teamsChatUrl('xdoupove@node.mendelu.cz')).toContain('users=xdoupove%40mendelu.cz');
  });

  it('leaves an address that is already on the tenant domain alone', () => {
    expect(teamsChatUrl('xholek1@mendelu.cz')).toContain('users=xholek1%40mendelu.cz');
    expect(teamsChatUrl('david.prochazka@mendelu.cz')).toContain(
      'users=david.prochazka%40mendelu.cz'
    );
  });

  it('does not rewrite an address from some other university', () => {
    // Erasmus hosts and external supervisors turn up in IS too. Rewriting their
    // domain would invent an address that belongs to somebody else entirely.
    expect(teamsChatUrl('someone@node.example.com')).toContain('users=someone%40node.example.com');
  });
});

describe('openTeamsChat', () => {
  const assign = vi.fn();
  const open = vi.fn();

  beforeEach(() => {
    assign.mockClear();
    open.mockClear();
    vi.spyOn(window.location, 'assign').mockImplementation(assign);
    vi.spyOn(window, 'open').mockImplementation(open);
  });

  it('navigates the WebView on Capacitor, so the OS hands the link to the Teams app', () => {
    // Not openExternal: that routes through the in-app browser, which keeps the
    // link inside a Custom Tab / SFSafariViewController and never reaches the
    // installed app. A top-level navigation is the one thing Capacitor's bridge
    // passes to the system (UIApplication.open / ACTION_VIEW), and the system is
    // what resolves the universal link to Teams — falling back to the web chat
    // when Teams is not installed.
    mockedGetPlatform.mockReturnValue({ kind: 'capacitor' } as never);
    openTeamsChat('novak@mendelu.cz');

    expect(assign).toHaveBeenCalledWith(teamsChatUrl('novak@mendelu.cz'));
    expect(open).not.toHaveBeenCalled();
  });

  it('opens a new tab everywhere else, so the extension does not navigate away from IS', () => {
    mockedGetPlatform.mockReturnValue({ kind: 'extension' } as never);
    openTeamsChat('novak@mendelu.cz');

    expect(open).toHaveBeenCalledWith(
      teamsChatUrl('novak@mendelu.cz'),
      '_blank',
      'noopener,noreferrer'
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
