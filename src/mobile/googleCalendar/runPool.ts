/**
 * Runs `tasks` with at most `concurrency` in flight, calling `onDone(n)` after
 * each completes. On the first failure no new task starts; the ones already
 * running finish, then the error is rethrown — so a killed or failed first fill
 * stops cleanly and resumes from what Google already has.
 */
export async function runPool(
  tasks: (() => Promise<void>)[],
  concurrency: number,
  onDone: (n: number) => void
): Promise<void> {
  let next = 0;
  let done = 0;
  let failure: { error: unknown } | null = null;

  async function worker(): Promise<void> {
    while (!failure && next < tasks.length) {
      const task = tasks[next++]!;
      try {
        await task();
        onDone(++done);
      } catch (error) {
        failure ??= { error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  if (failure) throw (failure as { error: unknown }).error;
}
