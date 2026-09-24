/**
 * Request queue with concurrency limiting.
 *
 * Prevents ERR_INSUFFICIENT_RESOURCES by limiting concurrent fetch requests.
 */

type QueuedRequest<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeCount = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: fn,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.activeCount++;

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  /**
   * Process items with limited concurrency.
   * More efficient than adding one-by-one for batches.
   */
  async processSequentially<T, R>(items: T[], processor: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (const item of items) {
      results.push(await this.add(() => processor(item)));
    }
    return results;
  }
}

// Global request queue - limit to 3 concurrent requests to IS Mendelu
export const requestQueue = new RequestQueue(3);

// Helper for batch processing with delay between items
export async function processWithDelay<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  delayMs: number = 100
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await processor(item));
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}
