import { useEffect, useState } from 'react';
import { fetchPersonPhoto } from '../../api/personPhoto';

// Session-lived cache of resolved data: URLs. Deriving the rendered value from
// this map (keyed by the current id) means an id change or remount shows the
// right photo immediately, with no flash of the previous person and no
// synchronous state reset (which the hooks lint disallows in render/effect).
const resolvedPhotos = new Map<string, string>();

export function __resetResolvedPhotos(): void {
    resolvedPhotos.clear();
}

/**
 * Resolves an IS person photo to a self-contained data: URL fetched via the
 * authenticated content-script proxy (see api/personPhoto). Returns null while
 * loading or on failure — callers render their own fallback (initials / icon).
 */
export function usePersonPhoto(personId: string | number | null | undefined): string | null {
    const id = personId == null || personId === '' ? null : String(personId);
    const [, bump] = useState(0);

    useEffect(() => {
        if (!id || resolvedPhotos.has(id)) return;
        let active = true;
        fetchPersonPhoto(id)
            .then((dataUrl) => {
                resolvedPhotos.set(id, dataUrl);
                if (active) bump((n) => n + 1);
            })
            .catch(() => { /* leave unresolved → caller keeps its fallback */ });
        return () => { active = false; };
    }, [id]);

    return id ? resolvedPhotos.get(id) ?? null : null;
}
