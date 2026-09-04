/**
 * Browser name and major version, parsed from the user agent.
 *
 * Lives here rather than under `services/errorReporter/` because that whole
 * directory is gone: reIS transmits nothing about a failure. The one remaining
 * caller is the feedback form, where the browser is part of what the student is
 * telling us — a bug report without "which browser" is rarely actionable — and
 * it is disclosed in the privacy policy as such.
 */
export interface BrowserInfo {
  name: string;
  version: string;
}

export function getBrowserInfo(userAgent: string = navigator.userAgent): BrowserInfo {
  if (!userAgent) return { name: 'Unknown', version: '0' };
  // Order matters: Edge UA also contains "Chrome".
  let m: RegExpMatchArray | null;
  // safe: each regex has exactly one required capturing group
  if ((m = userAgent.match(/Edg\/(\d+)/))) return { name: 'Edge', version: m[1]! };
  if ((m = userAgent.match(/Firefox\/(\d+)/))) return { name: 'Firefox', version: m[1]! };
  if ((m = userAgent.match(/Chrome\/(\d+)/))) return { name: 'Chrome', version: m[1]! };
  if ((m = userAgent.match(/Version\/(\d+).*Safari/))) return { name: 'Safari', version: m[1]! };
  return { name: 'Unknown', version: '0' };
}
