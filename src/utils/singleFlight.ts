/**
 * Wrap an async task so it never runs concurrently with itself. While a run is
 * in flight, further invocations only mark the result dirty and return; when the
 * run finishes, the task runs exactly once more if it was marked dirty. Lets the
 * latest state always get processed without overlapping passes.
 */
export function singleFlight(task: () => Promise<void>): () => Promise<void> {
    let running = false;
    let dirty = false;
    return async () => {
        if (running) { dirty = true; return; }
        running = true;
        try {
            do {
                dirty = false;
                await task();
            } while (dirty);
        } finally {
            running = false;
        }
    };
}
