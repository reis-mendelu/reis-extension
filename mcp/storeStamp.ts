// The one staleness rule for anything the store keeps of a file (its text in storeMap.ts, its
// original bytes in storeOriginals.ts), so the two can never disagree about a file.

/**
 * IS's Modifikace is a date without a time, so a file replaced later the day it
 * was read would look unchanged. A stored copy is therefore trusted only when
 * its read began on a later day than the date shown: any replacement after
 * the read then carries a different date. Same day, or no usable date, means
 * download again (the next read is saved under a later day and is trusted).
 */
export function readAfterModified(stamp: string, readAt: unknown): boolean {
  const m = /^modified\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(stamp);
  const read = new Date(String(readAt));
  if (!m || Number.isNaN(read.getTime())) return false;
  try {
    const modified = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    // IS dates are Czech dates, whatever the laptop's clock says.
    return read.toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }) > modified;
  } catch {
    return false;
  }
}
