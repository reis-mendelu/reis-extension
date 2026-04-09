/**
 * Utility for fetching and synchronizing with IS Mendelu server time.
 */

let cachedOffset: number | null = null;
let offsetPromise: Promise<number> | null = null;

/**
 * Asks the IS Mendelu server for the current time.
 * Calculates the exact offset between the local and server clocks.
 * 
 * Returns the offset in milliseconds.
 * (Target Server Time) = (Local Time) + offset
 */
export async function fetchServerTimeOffset(forceRefresh: boolean = false): Promise<number> {
    if (!forceRefresh && cachedOffset !== null) {
        return cachedOffset;
    }
    
    // Deduplicate in-flight requests
    if (offsetPromise) {
        return offsetPromise;
    }

    offsetPromise = (async () => {
        const startTime = Date.now();
        
        try {
            // Make a HEAD request to avoid downloading HTML bodies.
            // Append a random parameter to completely bypass the browser cache.
            const response = await fetch(`https://is.mendelu.cz/?_t=${Date.now()}`, {
                method: 'HEAD',
            });
            
            const endTime = Date.now();
            const dateHeader = response.headers.get('Date');
            if (!dateHeader) {
                throw new Error("Date header missing from response");
            }
            
            const serverTime = new Date(dateHeader).getTime();
            
            // Compensate for latency. 
            // We assume the server formed the response roughly halfway between request and response.
            const roundTripTime = endTime - startTime;
            const localTimeAtServerProcessing = startTime + (roundTripTime / 2);
            
            // Calculate the offset
            const offsetMs = serverTime - localTimeAtServerProcessing;
            
            console.log(`[AutoReg TimeSync] RTT: ${roundTripTime}ms. Offset: ${offsetMs}ms.`);
            cachedOffset = offsetMs;
            return offsetMs;
            
        } catch (error) {
            console.error("[AutoReg TimeSync] Failed to sync clock with server:", error);
            cachedOffset = 0; // Fallback to 0 offset (trust local clock) on failure
            return 0;
        } finally {
            offsetPromise = null;
        }
    })();

    return offsetPromise;
}

/**
 * Returns the current time perfectly synchronized to the server clock.
 */
export function getSynchronizedServerTime(): number {
    return Date.now() + (cachedOffset || 0);
}
