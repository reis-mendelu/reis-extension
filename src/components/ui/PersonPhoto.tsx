import type { ReactNode } from 'react';
import { usePersonPhoto } from '../../hooks/data/usePersonPhoto';

interface PersonPhotoProps {
    personId: string | number | null | undefined;
    alt: string;
    className?: string;
    /** Rendered while the photo loads or when none is available. */
    fallback: ReactNode;
}

/**
 * Renders an IS person photo via the authenticated proxy, falling back to the
 * provided node while loading or when the photo can't be fetched. Centralizes
 * the cross-browser photo loading so individual call sites keep only their own
 * fallback markup (initials, icon, sizing).
 */
export function PersonPhoto({ personId, alt, className, fallback }: PersonPhotoProps) {
    const src = usePersonPhoto(personId);
    if (!src) return <>{fallback}</>;
    return <img src={src} alt={alt} className={className} />;
}
