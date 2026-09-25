import type { SuggestionRow } from '../types/suggestions';

/** The mailbox reIS answers from — the address the privacy policy publishes. */
export const REPLY_ACCOUNT = 'reis.mendelu@gmail.com';

// Deliberately loose: the contact field is free text and this only decides
// whether to offer a Reply button. One @, no spaces, a dot in the domain.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address to reply to, or null when the contact is not an email. */
export function replyEmail(contact: string | null): string | null {
  const trimmed = contact?.trim() ?? '';
  return EMAIL.test(trimmed) ? trimmed : null;
}

function quote(body: string): string {
  return `\n\n${body
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')}`;
}

// encodeURIComponent rather than URLSearchParams: that one form-encodes a space
// as '+', which mailto (RFC 6068) does not decode, so the subject would read
// "Re:+přihlášení+na+wifi" in the mail app.
function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * A link that opens a reply draft to the student, or null with nobody to reply to.
 *
 * Not mailto: off the native app — on a Mac it opens whichever mail app the OS
 * picked, which is Apple Mail rather than the reIS Gmail. The compose URL opens
 * the draft in the browser, and `authuser` selects the reIS account over
 * whichever Google account is signed in first.
 *
 * The native app keeps mailto:, because there the OS hands it to the mail app
 * the phone's owner chose (the Gmail app, if it is the default), while a web
 * link would land in a Safari view that is not signed in to Gmail at all.
 */
export function buildReplyHref(
  row: Pick<SuggestionRow, 'title' | 'body' | 'contact'>,
  { native }: { native: boolean }
): string | null {
  const to = replyEmail(row.contact);
  if (!to) return null;
  const subject = `Re: ${row.title}`;
  const body = quote(row.body);
  if (native) return `mailto:${to}?${query({ subject, body })}`;
  return `https://mail.google.com/mail/?${query({
    authuser: REPLY_ACCOUNT,
    view: 'cm',
    fs: '1',
    to,
    su: subject,
    body,
  })}`;
}
