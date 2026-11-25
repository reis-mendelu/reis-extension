import { describe, it, expect, vi, beforeEach } from 'vitest';
import { switchExamTerm } from '../switchExamTerm';
import * as examsAPI from '../../../api/exams';
import * as swapAPI from '../../../api/examSwap';
import type { ExamSubject, ExamSection } from '../../../types/exams';

vi.mock('../../../api/exams');
vi.mock('../../../api/examSwap');
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
const before = () => list(OLD, [term(OLD), term(NEW)]);

describe('switchExamTerm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: true });
    vi.mocked(examsAPI.fetchExamData)
      .mockResolvedValueOnce(before()) // pre-flight
      .mockResolvedValueOnce(list(NEW, [term(OLD), term(NEW)])); // read-back
  });

  // IS swaps in one operation, so the old seat is never released on purpose:
  // no unregister, no rollback.
  it('swaps in IS’s single operation and never unregisters', async () => {
    expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'registered' });
    expect(swapAPI.swapExamTerm).toHaveBeenCalledWith(OLD, NEW);
    expect(examsAPI.unregisterExam).not.toHaveBeenCalled();
    expect(examsAPI.registerExam).not.toHaveBeenCalled();
  });

  describe('refuses before sending anything', () => {
    beforeEach(() => {
      vi.mocked(examsAPI.fetchExamData).mockReset();
    });

    it('when the new term has filled up since the list was loaded', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue(
        list(OLD, [term(OLD), term(NEW, { full: true })])
      );
      expect(await switchExamTerm(OLD, NEW)).toEqual({
        kind: 'refused',
        reason: 'targetUnavailable',
      });
      expect(swapAPI.swapExamTerm).not.toHaveBeenCalled();
    });

    it('when registration for the new term is not open', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue(
        list(OLD, [term(OLD), term(NEW, { canRegisterNow: false })])
      );
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'refused' });
      expect(swapAPI.swapExamTerm).not.toHaveBeenCalled();
    });

    it('when the old term can no longer be left', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue(
        list(OLD, [term(OLD), term(NEW)], '01.01.2020 23:59')
      );
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'refused', reason: 'locked' });
      expect(swapAPI.swapExamTerm).not.toHaveBeenCalled();
    });

    it('when the student is no longer registered on the old term', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue(list(null, [term(OLD), term(NEW)]));
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'refused', reason: 'unverified' });
      expect(swapAPI.swapExamTerm).not.toHaveBeenCalled();
    });

    it('when the fresh list cannot be read (fetchExamData hides a failure as [])', async () => {
      vi.mocked(examsAPI.fetchExamData).mockResolvedValue([]);
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'refused', reason: 'unverified' });
      expect(swapAPI.swapExamTerm).not.toHaveBeenCalled();
    });
  });

  // The list read back after the swap is the truth, whatever IS's page said.
  describe('reads the outcome back from IS', () => {
    const readBack = (after: ExamSubject[]) =>
      vi
        .mocked(examsAPI.fetchExamData)
        .mockReset()
        .mockResolvedValueOnce(before())
        .mockResolvedValueOnce(after);

    it('keeps the old seat when the swap fails and the list still shows it', async () => {
      vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: false, error: 'plno' });
      readBack(before());
      expect(await switchExamTerm(OLD, NEW)).toEqual({
        kind: 'failed',
        error: 'plno',
        seat: 'kept',
      });
    });

    it('calls it done when IS registered the new term although its page did not say so', async () => {
      vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: false, error: 'x' });
      readBack(list(NEW, [term(OLD), term(NEW)]));
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'registered' });
    });

    it('says the seat is lost when the list shows no term (never expected, never hidden)', async () => {
      vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: false, error: 'x' });
      readBack(list(null, [term(OLD), term(NEW)]));
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'failed', seat: 'lost' });
    });

    // Another tab or device can register a third term in between.
    it('does not call the seat lost when a third term got registered meanwhile', async () => {
      vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: false, error: 'x' });
      readBack(list('third-3', [term(OLD), term(NEW), term('third-3')]));
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'failed', seat: 'unknown' });
    });

    it('does not guess when the list cannot be read after a failed swap', async () => {
      vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: false, error: 'x' });
      readBack([]);
      expect(await switchExamTerm(OLD, NEW)).toMatchObject({ kind: 'failed', seat: 'unknown' });
    });

    it('trusts IS’s own confirmation when the list cannot be read after a good swap', async () => {
      readBack([]);
      expect(await switchExamTerm(OLD, NEW)).toEqual({ kind: 'registered' });
    });
  });
});
