import { BRAKPOINTS } from './constants';

export function getBreakpoint(width: number): number {
    if (width <= BRAKPOINTS[0]) return 0;
    if (width >= BRAKPOINTS[4]) return 4;
    for (const [key, value] of Object.entries(BRAKPOINTS)) {
        if (width < value) return parseInt(key);
    }
    return 0;
}
