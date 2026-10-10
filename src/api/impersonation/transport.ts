import { fetchWithAuth } from '../client';
import { TIMETABLE_URL } from './timetableQuery';

/**
 * Everything goes through `fetchWithAuth`, which already reaches IS from every
 * host: the extension iframe via the content script's REIS_FETCH proxy,
 * Capacitor natively, the content script directly.
 */
export const text = async (url: string, init?: RequestInit) =>
  (await fetchWithAuth(url, init)).text();

export const post = (body: string) => text(TIMETABLE_URL, { method: 'POST', body });

/**
 * Timetable POSTs are expensive for IS (reis-scraper keeps its crawl at 3).
 * The first rejection fails the whole call, so after it no worker starts
 * another item: the rest would be requests whose answers are thrown away.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let failed = false;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!failed && next < items.length) {
        const i = next++;
        try {
          out[i] = await fn(items[i]!);
        } catch (err) {
          failed = true;
          throw err;
        }
      }
    })
  );
  return out;
}
