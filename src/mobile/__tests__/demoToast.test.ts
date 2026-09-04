import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { handleDemoError } from '../demoToast';
import { DemoModeError } from '../../errors/demoMode';

vi.mock('sonner', () => ({ toast: vi.fn() }));

describe('handleDemoError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true and shows a toast for DemoModeError', () => {
    const error = new DemoModeError();

    const result = handleDemoError(error);

    expect(result).toBe(true);
    expect(toast).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith('Toto je jen ukázka.', expect.any(Object));
  });

  it('returns false and shows no toast for non-DemoModeError', () => {
    const error = new Error('regular error');

    const result = handleDemoError(error);

    expect(result).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it('uses a stable toast id so repeated calls replace instead of stack', () => {
    const error1 = new DemoModeError();
    const error2 = new DemoModeError();

    handleDemoError(error1);
    handleDemoError(error2);

    expect(toast).toHaveBeenCalledTimes(2);

    // Both calls carry the same id, which is what makes sonner replace the
    // toast instead of stacking a second identical one.
    //
    // Indexed reads are narrowed rather than asserted non-null: the repo's
    // `nuia:gate` runs tsc with noUncheckedIndexedAccess over this file, and a
    // bare `calls[0][1]` fails it. The length check above does not narrow the
    // index type, so the narrowing has to be explicit here.
    const [firstCall, secondCall] = vi.mocked(toast).mock.calls;
    if (!firstCall || !secondCall) throw new Error('expected two toast calls');

    const firstOptions = firstCall[1] as { id?: string } | undefined;
    const secondOptions = secondCall[1] as { id?: string } | undefined;

    expect(firstOptions?.id).toBeDefined();
    expect(firstOptions?.id).toBe(secondOptions?.id);
  });
});
