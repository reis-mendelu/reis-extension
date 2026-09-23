import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const idbGet = vi.fn();
const idbSet = vi.fn();
const idbClearAll = vi.fn();
const fetchUserBaseIds = vi.fn();
const fetchUserStudyDetails = vi.fn();
const fetchUserNetId = vi.fn();

vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: (...a: unknown[]) => idbGet(...a),
    set: (...a: unknown[]) => idbSet(...a),
    clearAll: () => idbClearAll(),
  },
}));
vi.mock('../userParams/fetchers', () => ({
  fetchUserBaseIds: () => fetchUserBaseIds(),
  fetchUserStudyDetails: () => fetchUserStudyDetails(),
  fetchUserNetId: () => fetchUserNetId(),
}));

const { getUserParams, clearUserParamsCache, isIdentityConfirmed } = await import('../userParams');
const { onIdentityChange } = await import('../userParams/identityEvents');

const COMPLETE = {
  studium: '149707',
  obdobi: '812',
  studentId: '120344',
  fullName: 'Jan Novák',
  isErasmus: false,
};

/** A DIFFERENT student — the next person to sign in on this browser. */
const OTHER = {
  studium: '201555',
  obdobi: '999',
  studentId: '987654',
  fullName: 'Tonda Vomáčka',
  isErasmus: false,
};

describe('getUserParams', () => {
  beforeEach(() => {
    clearUserParamsCache();
    idbGet.mockReset();
    idbSet.mockReset();
    idbClearAll.mockReset();
    fetchUserBaseIds.mockReset();
    fetchUserStudyDetails.mockReset().mockResolvedValue({});
    fetchUserNetId.mockReset().mockResolvedValue({ username: 'xnovak' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Once per context, and only once: the stored record is confirmed to belong
   * to the session that is signed in RIGHT NOW before it is served.
   *
   * This used to return the stored record with no network call at all, which
   * is the bug this file's `wipes` case describes — a complete record was
   * never revalidated, so it outlived the student it belonged to.
   */
  it('confirms the stored record against the live session, then caches it', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(COMPLETE);

    const params = await getUserParams();
    expect(params?.studentId).toBe('120344');
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
    expect(idbClearAll).not.toHaveBeenCalled();
    // Same student: the stored record is served as it stands. Rebuilding it
    // would cost two more IS pages on every single boot.
    expect(idbSet).not.toHaveBeenCalled();

    // And the confirmation is not repeated for the rest of the session.
    await getUserParams();
    await getUserParams();
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
  });

  /**
   * THE BUG. Sign out, hand the laptop to Tonda, Tonda signs in — and none of
   * his data loads, on an install that has to be deleted and re-added to
   * recover.
   *
   * A complete stored record was served forever without ever being checked
   * against the session, so every crawl went out carrying the PREVIOUS
   * student's `studium`. IS answers a foreign `studium` with its plain search
   * form rather than an error (see the note in `api/schedule`), so the parse
   * yields an empty timetable and nothing anywhere reports a failure.
   *
   * The record is only a cache of who is signed in. When IS says someone else
   * is, everything derived from the old answer has to go with it.
   */
  it('wipes the local data and adopts the new record when a different student is signed in', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    fetchUserNetId.mockResolvedValue({ username: 'xvomacka' });

    const params = await getUserParams();

    expect(idbClearAll).toHaveBeenCalledTimes(1);
    expect(params?.studentId).toBe('987654');
    expect(params?.studium).toBe('201555');
    expect(params?.obdobi).toBe('999');
    expect(params?.fullName).toBe('Tonda Vomáčka');
  });

  // The wipe has to land BEFORE the new record is written, or `clearAll` takes
  // the new student's own params straight back out again and the next boot has
  // nothing to verify against.
  it('wipes before it stores the new record', async () => {
    const order: string[] = [];
    idbGet.mockResolvedValue(COMPLETE);
    idbClearAll.mockImplementation(async () => void order.push('clear'));
    idbSet.mockImplementation(async () => void order.push('set'));
    fetchUserBaseIds.mockResolvedValue(OTHER);

    await getUserParams();
    expect(order).toEqual(['clear', 'set']);
  });

  // The app layer needs to know: the store is still holding the previous
  // student's schedule in memory, and no IDB wipe reaches that.
  it('announces the change so the app can reset itself', async () => {
    const seen: unknown[] = [];
    const off = onIdentityChange((_p, change) => seen.push(change));
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(OTHER);

    await getUserParams();
    off();
    expect(seen).toEqual([{ wiped: true }]);
  });

  // Same student, same session — no announcement, nothing reset.
  it('does not announce anything when the same student is still signed in', async () => {
    const seen: unknown[] = [];
    const off = onIdentityChange((p) => seen.push(p));
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(COMPLETE);

    await getUserParams();
    off();
    expect(seen).toEqual([]);
  });

  /**
   * Offline is not "somebody else". The check can only wipe on a POSITIVE
   * answer from IS naming a different student — a failed fetch leaves the
   * stored record exactly where it is, because `studium` is what the schedule,
   * the study plan, the teaching weeks and the grade history all read.
   */
  it('never wipes when the identity check cannot reach IS', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockRejectedValue(new Error('offline'));

    const params = await getUserParams();
    expect(idbClearAll).not.toHaveBeenCalled();
    expect(params?.studentId).toBe('120344');
  });

  it('never wipes when IS answers without an identity on the page', async () => {
    // An English `studium.pl` used to parse to an empty `studentId`. Treating
    // that as "a different student" would wipe a healthy install.
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue({ ...COMPLETE, studentId: '' });

    await getUserParams();
    expect(idbClearAll).not.toHaveBeenCalled();
  });

  /**
   * And it must not CLAIM to have confirmed one either. A page that parses
   * without an identity — IS answering in a language the regexes do not read,
   * a truncated body — proves nothing about who is signed in, and marking the
   * session confirmed on it stops the watcher retrying and freezes the
   * previous student's record in place for the whole session. That is the
   * original bug wearing a different hat.
   */
  it('does not count an answer with no identity on it as a confirmation', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue({ ...COMPLETE, studentId: '' });

    await getUserParams();
    expect(isIdentityConfirmed()).toBe(false);
  });

  // A first install must still get its params out of such a page. Bailing out
  // with null instead would leave the app with no `studium` at all — no
  // schedule, no study plan, no grade history — which is worse than an
  // unconfirmed record.
  it('still builds a record from a page with no identity on it', async () => {
    idbGet.mockResolvedValue(undefined);
    fetchUserBaseIds.mockResolvedValue({ ...COMPLETE, studentId: '' });

    const params = await getUserParams();
    expect(params?.studium).toBe('149707');
    expect(idbSet).toHaveBeenCalled();
  });

  /**
   * The wipe is not undoable, so once it has happened the previous student's
   * record must never be served again — and everything after it can throw.
   *
   * `fetchUserStudyDetails` rejecting here used to fall into the catch, which
   * handed back the record belonging to the student who just left, cached it
   * for the session, and skipped the announcement that restarts the app. The
   * new student then had an emptied database AND a crawl going out under the
   * old `studium` — exactly the state this whole change exists to end.
   */
  it('never serves the previous student’s record once the wipe has happened', async () => {
    const seen: unknown[] = [];
    const off = onIdentityChange((p) => seen.push(p));
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    fetchUserStudyDetails.mockRejectedValue(new Error('IS hiccup'));

    const params = await getUserParams();
    off();

    expect(idbClearAll).toHaveBeenCalledTimes(1);
    expect(params).toBeNull();
    // The app still has to be told: its store is holding the previous
    // student's schedule, and no database wipe reaches that.
    expect(seen).toHaveLength(1);
  });

  // And the next call repairs rather than resurrecting: the wipe emptied the
  // store, so there is nothing left to mistake for the new student's record.
  it('rebuilds on the next call after a failed switch', async () => {
    idbGet.mockResolvedValueOnce(COMPLETE).mockResolvedValue(undefined);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    fetchUserStudyDetails.mockRejectedValueOnce(new Error('IS hiccup')).mockResolvedValue({});

    expect(await getUserParams()).toBeNull();
    const params = await getUserParams();
    expect(params?.studentId).toBe('987654');
  });

  /**
   * The wipe ITSELF failing is a different case from a failure after it: the
   * previous student's record is still on disk. Asking for a restart there
   * looped — the next boot recomputed the same switch from the same record,
   * the wipe failed the same way, and the app reloaded forever with no cap.
   *
   * The app is still told (the society session has to go either way), but
   * with `wiped: false`, so it knows a restart would only find the record
   * again.
   */
  it('does not ask for a restart when the wipe itself fails', async () => {
    const seen: unknown[] = [];
    const off = onIdentityChange((p, change) => seen.push({ p, change }));
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    idbClearAll.mockRejectedValue(new Error('IndexedDB unavailable'));

    const params = await getUserParams();
    off();

    expect(params).toBeNull();
    expect(seen).toEqual([{ p: null, change: { wiped: false } }]);
  });

  /**
   * And it has to stay null. `_identityChecked` is already true by then — IS
   * did answer — so the next read would otherwise find a complete record on
   * disk, take it as confirmed, and hand the new student the previous one's
   * `studium`. Serving nothing for the rest of the session is the only answer
   * that is not somebody else's identity.
   */
  it('serves nothing for the rest of the session once the wipe has failed', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    idbClearAll.mockRejectedValue(new Error('IndexedDB unavailable'));

    expect(await getUserParams()).toBeNull();
    expect(await getUserParams()).toBeNull();
    expect(await getUserParams()).toBeNull();
    // Nor does each read go back to IS to rediscover the same switch.
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
  });

  // A sign-out is the one thing that lifts it: it is about to retry the wipe.
  it('asks IS again after a sign-out clears the cache', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    idbClearAll.mockRejectedValueOnce(new Error('IndexedDB unavailable'));

    expect(await getUserParams()).toBeNull();
    clearUserParamsCache();
    idbGet.mockResolvedValue(undefined);

    const params = await getUserParams();
    expect(params?.studentId).toBe('987654');
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(2);
  });

  // A failing check must not turn into a fetch storm: ~20 call sites read
  // these params per session, and offline every one of them would try IS
  // again. Serve the stored record for the rest of the session and re-check on
  // the next boot.
  it('stops re-checking after the check fails once', async () => {
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockRejectedValue(new Error('offline'));

    await getUserParams();
    await getUserParams();
    await getUserParams();
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);
  });

  /**
   * But it does not give up for the whole session either. The first attempt
   * fails for reasons that pass — offline, a slow IS, or the iframe's fetch
   * proxy racing the content script at boot — and an unconfirmed record frozen
   * in place until the next launch is exactly the state this guard exists to
   * end. A minute later, the next read asks again.
   */
  it('asks again on a later call, once the gap has passed', async () => {
    vi.useFakeTimers();
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockRejectedValue(new Error('offline'));

    await getUserParams();
    expect(fetchUserBaseIds).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    await getUserParams();

    expect(fetchUserBaseIds).toHaveBeenCalledTimes(2);
    expect(idbClearAll).toHaveBeenCalledTimes(1);
  });

  /**
   * A read that lands WHILE a check is naming someone else. The offline first
   * attempt left the previous student's record cached, unconfirmed; the later
   * check sets `_identityChecked` as soon as IS answers, then waits on the
   * wipe. A read in that window passed the cache shortcut and got the previous
   * student's record — confirmed, as far as it knew. It has to wait for the
   * check instead.
   */
  it('never serves the cached record to a read made while a switch is being handled', async () => {
    vi.useFakeTimers();
    idbGet.mockResolvedValue(COMPLETE);
    fetchUserBaseIds.mockRejectedValueOnce(new Error('offline'));
    await getUserParams(); // caches the previous student, unconfirmed

    vi.advanceTimersByTime(61_000);
    fetchUserBaseIds.mockResolvedValue(OTHER);
    let finishWipe: () => void = () => {};
    idbClearAll.mockImplementation(() => new Promise<void>((r) => (finishWipe = r)));

    const check = getUserParams();
    await vi.waitFor(() => expect(idbClearAll).toHaveBeenCalledTimes(1));
    const during = getUserParams(); // lands mid-wipe
    finishWipe();

    expect((await check)?.studentId).toBe('987654');
    expect((await during)?.studentId).toBe('987654');
  });

  /**
   * `complete()` asks for a name as well as an id, and the switch used to ask
   * for `complete()`. A stored record carrying the previous student's id but
   * no name therefore skipped the wipe — and the new student's params were
   * written straight over it, beside the previous student's schedule and
   * classmates. The id is what says whose data it is; compare it whenever
   * both sides have one.
   */
  it('wipes on a different student id even when the stored record has no name', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '120344' });
    fetchUserBaseIds.mockResolvedValue(OTHER);

    const params = await getUserParams();
    expect(idbClearAll).toHaveBeenCalledTimes(1);
    expect(params?.studentId).toBe('987654');
  });

  /**
   * A stored record with no id at all cannot be attributed, and it is not
   * wiped. That shape is the English-`studium.pl` half-record, written for the
   * SAME student, and a wipe would take their local-only data (notes, their
   * own calendar events) with it. It is repaired in place instead.
   */
  it('repairs a stored record with no id rather than wiping it', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812' });
    fetchUserBaseIds.mockResolvedValue(COMPLETE);

    const params = await getUserParams();
    expect(idbClearAll).not.toHaveBeenCalled();
    expect(params?.studentId).toBe('120344');
  });

  /**
   * The one that matters. A record written while IS was answering in English
   * has `studium`/`obdobi` and nothing else — and the old guard accepted it as
   * complete, so the empty `studentId` outlived the parser bug that produced
   * it. Every install that ever stored one would stay photo-less no matter
   * what the fetchers learned to parse.
   */
  it('refetches when the stored record has no identity on it', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockResolvedValue(COMPLETE);
    const params = await getUserParams();
    expect(fetchUserBaseIds).toHaveBeenCalled();
    expect(params?.studentId).toBe('120344');
    expect(params?.fullName).toBe('Jan Novák');
  });

  // A refetch that comes back empty must not wipe what is already stored:
  // stale identity beats none, and the next launch tries again.
  it('keeps the stored record when the refetch yields nothing', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockResolvedValue(null);
    const params = await getUserParams();
    expect(params?.studium).toBe('149707');
  });

  /**
   * And the same when it THROWS, which is the common case offline — a rejection
   * used to fall through to the outer catch and return null, so adding the
   * refetch would have cost every offline launch the `studium` that the
   * schedule, study plan, teaching weeks and grade history all read. Before the
   * refetch existed this path never touched the network at all, so this is a
   * regression the refetch introduced rather than a pre-existing gap.
   */
  it('keeps the stored record when the refetch throws', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockRejectedValue(new Error('offline'));
    const params = await getUserParams();
    expect(params?.studium).toBe('149707');
    expect(params?.obdobi).toBe('812');
  });

  // The later stages reject into the same catch, and the guarantee has to hold
  // for the whole chain rather than just its first link.
  it('keeps the stored record when a later refresh stage throws', async () => {
    idbGet.mockResolvedValue({ studium: '149707', obdobi: '812', studentId: '', fullName: '' });
    fetchUserBaseIds.mockResolvedValue(COMPLETE);
    fetchUserStudyDetails.mockRejectedValue(new Error('offline'));
    expect((await getUserParams())?.studium).toBe('149707');

    clearUserParamsCache();
    fetchUserStudyDetails.mockResolvedValue({});
    fetchUserNetId.mockRejectedValue(new Error('offline'));
    expect((await getUserParams())?.studium).toBe('149707');
  });

  // Nothing stored and nothing fetchable is still null, not a half-object.
  it('returns null when there is neither a stored record nor a fetch', async () => {
    idbGet.mockResolvedValue(undefined);
    fetchUserBaseIds.mockRejectedValue(new Error('offline'));
    expect(await getUserParams()).toBeNull();
  });
});
