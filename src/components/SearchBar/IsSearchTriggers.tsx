import { UserSearch } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PeopleSearchPopover } from './PeopleSearchPopover';

/** Which IS-flyout search popover is open, if any. */
export type IsSearchTarget = 'people' | null;

interface IsSearchTriggersProps {
  onOpen: (target: IsSearchTarget) => void;
  /** Row styling differs between the desktop flyout and the mobile sheet. */
  buttonClassName: string;
}

/** The "Lidé" trigger row shown in the desktop IS flyout. ("Starý IS" is its own sidebar item.) */
export function IsSearchTriggers({ onOpen, buttonClassName }: IsSearchTriggersProps) {
  const { t } = useTranslation();
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen('people');
        }}
        className={buttonClassName}
      >
        <UserSearch className="w-4 h-4 text-base-content/50" />
        <span className="font-medium truncate">{t('sidebar.people')}</span>
      </button>
    </>
  );
}

/**
 * The popovers behind the triggers. Mounted separately from the trigger rows
 * (outside the hover flyout) so an open popover survives the flyout closing.
 * Popovers are only mounted while open, so idle instances cost nothing
 * (PeopleSearchPopover's useSearch subscribes to the store).
 */
export function IsSearchPopovers({ open, onClose }: { open: IsSearchTarget; onClose: () => void }) {
  return <>{open === 'people' && <PeopleSearchPopover isOpen onClose={onClose} />}</>;
}
