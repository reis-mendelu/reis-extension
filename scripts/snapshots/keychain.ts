import { execFileSync } from 'node:child_process';

/**
 * The MENDELU login for the snapshot job, read from the macOS Keychain.
 *
 * The student stores it once, typing the password into `security`'s own
 * prompt (see README.md here), so it is never in a file, an env var or a
 * chat. Nothing here prints it.
 */
export const KEYCHAIN_SERVICE = 'reIS snapshots';

export interface Credentials {
  user: string;
  pass: string;
}

function security(args: string[]): string {
  return execFileSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function readCredentials(service = KEYCHAIN_SERVICE): Credentials | null {
  let attrs: string;
  try {
    attrs = security(['find-generic-password', '-s', service]);
  } catch {
    return null;
  }
  const user = /"acct"<blob>="([^"]*)"/.exec(attrs)?.[1];
  if (!user) return null;
  const pass = security(['find-generic-password', '-s', service, '-w']).replace(/\n$/, '');
  return pass ? { user, pass } : null;
}
