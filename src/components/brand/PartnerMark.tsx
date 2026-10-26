import type { Society } from '../../types/events';
import { useTheme } from '../../hooks/useTheme';
import { EyMark } from './EyMark';

/**
 * One partner's colour mark, as uploaded in the console: no plate, no card,
 * no link (AboutSection says why). Dark mode takes the dark mark when there is
 * one. EY keeps its inline mark until its uploads exist, so the first partner
 * never goes blank; anyone else without a mark shows as their name.
 */
export function PartnerMark({
  partner,
  className = 'h-7',
}: {
  partner: Society;
  className?: string;
}) {
  const { isDark } = useTheme();
  const src = (isDark && partner.markDark) || partner.markLight;
  if (src) return <img src={src} alt={partner.name} className={`w-auto ${className}`} />;
  if (partner.id === 'ey') return <EyMark className={`${className} text-base-content`} />;
  return <span className="text-sm font-semibold text-base-content">{partner.name}</span>;
}
