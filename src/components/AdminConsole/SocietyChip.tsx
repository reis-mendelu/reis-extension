import type { Society } from '../../types/events';
import { SocietyLogo } from '../SocietyLogo';

// The society you are acting as, shown when it is fixed (an association account
// can only ever be itself). reIS admins get SocietyPicker in this slot instead.
export function SocietyChip({ society }: { society: Society }) {
  return (
    <span className="flex items-center gap-2">
      <SocietyLogo society={society} className="h-6 w-6 rounded-md text-[10px]" fit="contain" />
      <span className="truncate text-sm font-bold">{society.name}</span>
    </span>
  );
}
