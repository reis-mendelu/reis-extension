import { describe, it, expect, vi, beforeEach } from 'vitest';
import { switchExamTerm } from '../switchExamTerm';
import * as examsAPI from '../../../api/exams';
import type { ExamSubject, ExamSection } from '../../../types/exams';

vi.mock('../../../api/exams');
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

const term = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  date: '20.01.2099',
  time: '09:00',
  full: false,
  canRegisterNow: true,
  ...o,
});

/** One exam section as IS lists it: registered on `registeredId` (or none). */
function list(
  registeredId: string | null,
  terms: ReturnType<typeof term>[],
  deregistrationDeadline?: string
): ExamSubject[] {
  const section = {
    id: 'sec-1',
    name: 'zkouška',
    type: 'exam',
    status: registeredId ? 'registered' : 'available',
    terms,
    registeredTerm: registeredId
      ? { id: registeredId, date: '10.01.2099', time: '09:00', deregistrationDeadline }
      : undefined,
  } as unknown as ExamSection;
  return [{ version: 1, id: 's', name: 'Test', code: 'TST', sections: [section] }];
}

const OLD = 'old-1';
const NEW = 'new-2';

describe('switchExamTerm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(examsAPI.unregisterExam).mockResolvedValue({ success: true });
    vi.mocked(examsAPI.registerExam).mockResolvedValue({ success: true });
    vi.mocked(examsAPI.fetchExamData).mockResolvedValue(list(OLD, [term(OLD), term(NEW)]));
  });

  it('unregisters the old term, then registers the new one', async () => {
    expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'registered' });
    expect(examsAPI.unregisterExam).toHaveBeenCalledWith(OLD);
    expect(examsAPI.registerExam).toHaveBeenCalledWith(NEW);
  });

  // The seat is only ever put at risk by the unregister, so everything that can
  // be checked beforehand is checked on a FRESH list before it.
  describe('refuses before touching the seat', () => {
    it('when the new term has filled up since the list was loaded', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue(
        list(OLD, [term(OLD), term(NEW, { full: true })])
      );
      expect(await switchExamTerm(OLD, NEW)).toEqual({
        kind: 'refused',
        reason: 'targetUnavailable',
      });
      expect(examsAPI.unregisterExam).not.toHaveBeenCalled();
    });

    it('when registration for the new term is not open', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue(
        list(OLD, [term(OLD), term(NEW, { canRegisterNow: false })])
      );
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'refused' });
      expect(examsAPI.unregisterExam).not.toHaveBeenCalled();
    });

    it('when the old term can no longer be deregistered', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue(
        list(OLD, [term(OLD), term(NEW)], '01.01.2020 23:59')
      );
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'refused', reason: 'locked' });
      expect(examsAPI.unregisterExam).not.toHaveBeenCalled();
    });

    it('when the fresh list cannot be read (fetchExamData hides a failure as [])', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue([]);
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'refused', reason: 'unverified' });
      expect(examsAPI.unregisterExam).not.toHaveBeenCalled();
    });
  });

  it('reports a failed unregister without trying to register', async () => {
    vi.mocked(examsAPI.unregisterExam).mockResolvedValue({ success: false, error: 'x' });
    expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'unregisterFailed', error: 'x' });
    expect(examsAPI.registerExam).not.toHaveBeenCalled();
  });

  describe('when registering the new term fails after the old one is gone', () => {
    beforeEach(() => {
      vi.mocked(examsAPI.registerExam).mockImplementation(async (id) =>
        id === NEW ? { success: false, error: 'plno' } : { success: true }
      );
    });

    it('says restored only when the fresh list shows the old term registered', async () => {
      vi.mocked(examsAPI.fetchExamData)
        .mockResolvedValueOnce(list(OLD, [term(OLD), term(NEW)])) // pre-flight
        .mockResolvedValueOnce(list(OLD, [term(OLD), term(NEW)])); // after
      expect(await switchExamTerm(OLD, NEW)).toEqual({
        kind: 'failed',
        error: 'plno',
        seat: 'restored',
      });
    });

    // The rollback call can answer "ok" and be wrong; the list is the truth.
    it('says the seat is lost when rollback claims success but the list shows no term', async () => {
      vi.mocked(examsAPI.fetchExamData)
        .mockResolvedValueOnce(list(OLD, [term(OLD), term(NEW)]))
        .mockResolvedValueOnce(list(null, [term(OLD), term(NEW)]));
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'failed', seat: 'lost' });
    });

    it('says the seat is lost when the rollback fails and the list shows no term', async () => {
      vi.mocked(examsAPI.registerExam).mockResolvedValue({ success: false, error: 'plno' });
      vi.mocked(examsAPI.fetchExamData)
        .mockResolvedValueOnce(list(OLD, [term(OLD), term(NEW)]))
        .mockResolvedValueOnce(list(null, [term(OLD, { full: true }), term(NEW)]));
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'failed', seat: 'lost' });
    });

    it('treats the switch as done when IS did register the new term after all', async () => {
      vi.mocked(examsAPI.fetchExamData)
        .mockResolvedValueOnce(list(OLD, [term(OLD), term(NEW)]))
        .mockResolvedValueOnce(list(NEW, [term(OLD), term(NEW)]));
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'registered' });
    });

    it('does not guess when the list cannot be read: unknown, not restored', async () => {
      vi.mocked(examsAPI.registerExam).mockResolvedValue({ success: false, error: 'plno' });
      vi.mocked(examsAPI.fetchExamData)
        .mockResolvedValueOnce(list(OLD, [term(OLD), term(NEW)]))
        .mockResolvedValueOnce([]);
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'failed', seat: 'unknown' });
    });
  });
});
