import { useTranslation } from '../../../hooks/useTranslation';
import { usePartnerInternships } from '../../../hooks/usePartnerInternships';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { InternshipList } from '../../Internships/InternshipList';

/** Stáže on the phone: the sheet behind the briefcase in `HeaderActions`. */
export function InternshipsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const items = usePartnerInternships();

  return (
    <Sheet size="full" onClose={onClose}>
      <SheetHeader title={t('internships.title')} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <InternshipList items={items} />
      </div>
    </Sheet>
  );
}
