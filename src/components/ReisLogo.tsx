import { useAppStore } from '../store/useAppStore';

interface ReisLogoProps {
  className?: string;
}

/**
 * Inline reIS logo SVG that adapts its background to the current theme.
 * Dark theme → dark rounded rect background with white R.
 * Light theme → transparent background with dark R.
 */
export function ReisLogo({ className = 'w-8 h-8' }: ReisLogoProps) {
    const theme = useAppStore(s => s.theme);
    const isDark = theme === 'mendelu-dark';

    const bg = isDark ? '#111827' : 'transparent';
    const letter = isDark ? '#ffffff' : '#111827';
    const dotStroke = isDark ? '#111827' : '#f3f4f6';

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 128 128"
            className={className}
        >
            <rect width="128" height="128" rx="24" fill={bg} />
            <path
                d="M38 88V86h4V42h-4V40h24c12 0 20 8 20 18s-7 17-17 18l18 12H69L55 76H54v10h4v2H38z M54 66h10c6 0 10-4 10-10s-4-8-10-8H54v18z"
                fill={letter}
                fillRule="evenodd"
            />
            <circle cx="32" cy="96" r="16" fill="#79be15" stroke={dotStroke} strokeWidth="4" />
        </svg>
    );
}
