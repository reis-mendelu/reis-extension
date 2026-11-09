import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { logError } from '../utils/reportError';
import type { IsNoticeMute } from '../types/isNotices';

const RowSchema = z.object({ notice_key: z.string(), title: z.string() });

/**
 * The IS notices a reIS admin turned off for everyone (`is_notice_mutes`).
 * A public, anonymous read: nothing about the student goes up, not even which
 * notices their IS shows — the device downloads the whole list and filters
 * locally.
 *
 * `null` when the answer is unknown, so the caller keeps its last list rather
 * than un-muting everything on a failed request.
 */
export async function fetchIsNoticeMutes(): Promise<IsNoticeMute[] | null> {
  try {
    const { data, error } = await supabase
      .from('is_notice_mutes')
      .select('notice_key, title')
      .limit(500);
    if (error || !Array.isArray(data)) {
      if (error) logError('Api.fetchIsNoticeMutes', error);
      return null;
    }
    return data.flatMap((raw) => {
      const r = RowSchema.safeParse(raw);
      return r.success ? [{ key: r.data.notice_key, title: r.data.title }] : [];
    });
  } catch (err) {
    logError('Api.fetchIsNoticeMutes', err);
    return null;
  }
}
