import { Search, UserSearch } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { IsPortalPopover } from './IsPortalPopover';
import { PeopleSearchPopover } from './PeopleSearchPopover';

/** Which IS-flyout search popover is open, if any. */
export type IsSearchTarget = 'pages' | 'people' | null;

interface IsSearchTriggersProps {
  onOpen: (target: IsSearchTarget) => void;
  /** Row styling differs between the desktop flyout and the mobile sheet. */
  buttonClassName: string;
}

/** The "IS stránky" + "Lidé" trigger rows shown in the IS flyout (desktop sidebar and mobile sheet). */
export function IsSearchTriggers({ onOpen, buttonClassName }: IsSearchTriggersProps) {
  const { t } = useTranslation();
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen('pages'); }}
        className={buttonClassName}
      >
        <Search className="w-4 h-4" />
        <span>{t('sidebar.isPages')}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen('people'); }}
        className={buttonClassName}
      >
        <UserSearch className="w-4 h-4" />
        <span>{t('sidebar.people')}</span>
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
  return (
    <>
      {open === 'pages' && <IsPortalPopover isOpen onClose={onClose} />}
      {open === 'people' && <PeopleSearchPopover isOpen onClose={onClose} />}
    </>
  );
}
