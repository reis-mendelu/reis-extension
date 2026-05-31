import { useState, useEffect } from 'react';
import { getImage } from '../../services/notes/noteImageStore';

/** Resolve a note-image hash to an object URL, revoked on unmount/hash change. */
export function useNoteImage(hash: string): string | null {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        let made: string | null = null;
        void getImage(hash).then((img) => {
            if (!active || !img) { if (active) setUrl(null); return; }
            made = URL.createObjectURL(img.blob);
            setUrl(made);
        });
        return () => { active = false; if (made) URL.revokeObjectURL(made); };
    }, [hash]);
    return url;
}
