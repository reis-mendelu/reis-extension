import { useState, useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 767px) and (pointer: coarse)';

export function useIsMobile(): boolean {
    // Default to false (desktop) — the app runs inside an iframe that may
    // have zero width at the moment React first renders on page reload.
    // The real value is set in useEffect once the iframe is laid out.
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(MOBILE_QUERY);
        setIsMobile(mql.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    return isMobile;
}
