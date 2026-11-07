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
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        <p className="text-sm text-base-content/60">{t('internships.intro')}</p>
        <InternshipList items={items} />
      </div>
    </Sheet>
  );
}
