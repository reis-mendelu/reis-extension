import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { logError } from '@/utils/reportError';
import { getAppVersion, getHostLabel } from '@/utils/appIdentity';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/feedback-relay`;

export interface FeedbackReport {
  type: 'bug' | 'idea' | 'other';
  title: string;
  message: string;
  contact?: string;
}

/**
 * Diagnostic context, gathered here rather than server-side because only the
 * client can see it. Deliberately narrow: what a triager needs to reproduce a
 * report, and nothing that identifies the student. The student's name and UIC
 * are never read, and `contact` is whatever they chose to type — the form says
 * it is optional and means it.
 */
function collectContext() {
  return {
    // Read, not hand-maintained: this once said 4.0.0 while the app shipped
    // 5.x, so every report named a version that had not existed for two majors.
    version: getAppVersion(),
    host: getHostLabel(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`,
  };
}

/**
 * Send a feedback report through the secret-gated edge relay.
 *
 * The client used to POST straight to a Discord webhook whose URL was a
 * compile-time constant. That URL therefore shipped inside every build — and an
 * Android APK on a public listing is trivially unzipped, while a Discord webhook
 * accepts unauthenticated POSTs from anyone holding it. Rotating it would not
 * have helped: the replacement would ship in the next build exactly as the old
 * one did. So the URL now lives only in the relay's environment, and what the
 * bundle carries is a function endpoint that rejects callers without the shared
 * secret and rate-limits the ones that have it.
 *
 * Resolves `false` instead of throwing: a failed report is a toast, never an
 * unhandled rejection escalated into the error reporter.
 */
export async function sendFeedbackReport(report: FeedbackReport): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
      },
      body: JSON.stringify({ ...report, context: collectContext() }),
    });

    // `res.ok` alone is not enough. A captive portal or an interposing proxy
    // answering 200 with its own page would otherwise read as a delivered
    // report, and the student would never think to send it again.
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return res.ok && data.ok === true;
  } catch (err) {
    logError('Api.sendFeedbackReport', err);
    return false;
  }
}
