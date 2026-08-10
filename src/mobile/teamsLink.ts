import { getPlatform } from '../platform';

/** The Microsoft 365 tenant everyone at MENDELU is addressed by. */
const TENANT_DOMAIN = 'mendelu.cz';

/**
 * The address Teams can actually resolve, which is not always the one IS shows.
 *
 * IS publishes some students on its OWN mail host — `xdoupove@node.mendelu.cz`
 * — and Microsoft 365 has never heard of that domain. Verified on a real
 * handset: the `node.` form opens "New chat / Couldn't load chat" with an empty
 * recipient, while the same person as `xdoupove@mendelu.cz` opens the chat with
 * their name filled in.
 *
 * Only subdomains of the tenant are folded in. An Erasmus supervisor at another
 * university keeps their own domain: rewriting it would not fail politely, it
 * would address a stranger.
 */
export function teamsAddress(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return email.trim();
  const local = email.slice(0, at).trim();
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  const onTenant = domain === TENANT_DOMAIN || domain.endsWith(`.${TENANT_DOMAIN}`);
  return `${local}@${onTenant ? TENANT_DOMAIN : domain}`;
}

/**
 * Microsoft's documented deep link for "start a chat with this person". The two
 * zeros are the (unused) thread id and message positions; `users` takes UPNs,
 * which is why the address goes through `teamsAddress` first.
 */
export function teamsChatUrl(email: string): string {
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(teamsAddress(email))}`;
}

/**
 * Opens a Teams chat with someone, in the Teams app when it is installed.
 *
 * Deliberately NOT `openExternal`: on Capacitor that hands the URL to the
 * in-app browser (Custom Tabs / SFSafariViewController), and a link opened
 * there stays in the browser — the whole point of the button is to land in the
 * app the student already has signed in.
 *
 * A top-level navigation is what Capacitor's bridge passes to the OS
 * (`UIApplication.open` on iOS, `ACTION_VIEW` on Android); the OS resolves the
 * universal link to Teams, or opens the web chat if Teams is not installed.
 * That fallback is why this uses the https link rather than the `msteams:`
 * scheme, which would fail silently on a phone without Teams.
 */
export function openTeamsChat(email: string): void {
  const url = teamsChatUrl(email);

  if (getPlatform().kind === 'capacitor') {
    window.location.assign(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
