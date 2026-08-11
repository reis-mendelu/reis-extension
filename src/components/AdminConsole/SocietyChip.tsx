import type { Society } from '../../types/events';

// The society you are acting as, shown when it is fixed (an association account
// can only ever be itself). reIS admins get SocietyPicker in this slot instead.
export function SocietyChip({ society }: { society: Society }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md text-[10px] font-bold text-white"
        style={{ backgroundColor: society.logo ? undefined : society.color }}
      >
        {society.logo ? (
          <img src={society.logo} alt="" className="h-full w-full object-contain" />
        ) : (
          society.shortName.slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="truncate text-sm font-bold">{society.name}</span>
    </span>
  );
}
