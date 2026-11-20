import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { logError } from '../utils/reportError';
import type { CriticalVersion } from '../utils/criticalUpdate';

const RowSchema = z.object({
  min_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  reason_cz: z.string().min(1),
  reason_en: z.string().min(1),
});

/**
 * The critical app version (`critical_app_version`, one row or none), set by
 * reIS when an IS change broke older builds. A public, anonymous read: the
 * request carries nothing about the student, not even the app's own version;
 * the device compares (utils/criticalUpdate).
 *
 * `null` when there is none, or when the answer is unknown: a failed request
 * never tells a student their app is broken.
 */
export async function fetchCriticalVersion(): Promise<CriticalVersion | null> {
  try {
    const { data, error } = await supabase
      .from('critical_app_version')
      .select('min_version, reason_cz, reason_en')
      .limit(1);
    if (error || !Array.isArray(data)) {
      if (error) logError('Api.fetchCriticalVersion', error);
      return null;
    }
    const r = RowSchema.safeParse(data[0]);
    if (!r.success) return null;
    return {
      minVersion: r.data.min_version,
      reason: { cz: r.data.reason_cz, en: r.data.reason_en },
    };
  } catch (err) {
    logError('Api.fetchCriticalVersion', err);
    return null;
  }
}
