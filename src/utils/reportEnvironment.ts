import { getPlatform } from '@/platform';

export type ReportPlatform = 'extension' | 'ios' | 'android' | 'web';

/** OS family and, where the UA carries one, the major version. */
export function osOf(ua: string): string {
  let m: RegExpMatchArray | null;
  // safe: each regex has exactly one required capturing group
  if ((m = ua.match(/(?:iPhone )?OS (\d+)_\d+ like Mac OS X/))) return `iOS ${m[1]!}`;
  if ((m = ua.match(/Android (\d+)/))) return `Android ${m[1]!}`;
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return 'unknown';
}

export async function platformOf(): Promise<ReportPlatform> {
  const kind = getPlatform().kind;
  if (kind !== 'capacitor') return kind;
  // Lazy for the same reason as api/personPhoto: keeps @capacitor/core out of
  // the extension's static graph.
  const { Capacitor } = await import('@capacitor/core');
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

/**
 * The two labels every report carries about the device it was SENT from: the
 * platform and the OS (major version where the user agent has one). No device
 * model. Not necessarily the device with the bug, which is why the form's hint
 * also asks the student to name it.
 */
export async function reportEnvironment(): Promise<{ platform: ReportPlatform; os: string }> {
  return { platform: await platformOf(), os: osOf(navigator.userAgent) };
}
