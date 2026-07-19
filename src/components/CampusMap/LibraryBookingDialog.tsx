import { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { missingIdentityFields } from '@/services/library/bookingRequest';
import type { BookingError, LibraryRoom } from '@/types/library';

const ERROR_KEY: Record<BookingError, string> = {
  conflict: 'map.libraryBookConflict',
  rate_limited: 'map.libraryBookRateLimited',
  offline: 'map.libraryBookOffline',
  invalid: 'map.libraryBookInvalid',
  upstream: 'map.libraryBookInvalid',
};

// Explicit confirm step before a real reservation. Identity is prefilled from
// IS (fullName / email / studentId) but editable; submission is blocked until
// all three are present. The copy states the booking is real.
export function LibraryBookingDialog({
  room,
  slotIso,
  onClose,
}: {
  room: LibraryRoom;
  slotIso: string;
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const loc = language === 'cz' ? 'cs' : language;
  const bookRoom = useAppStore((s) => s.bookRoom);
  const key = `${room.staffGuid}|${slotIso}`;
  const status = useAppStore((s) => s.bookingStatus[key]);
  const error = useAppStore((s) => s.bookingError[key]);

  const [name, setName] = useState(useAppStore.getState().fullName ?? '');
  const [email, setEmail] = useState(useAppStore.getState().userEmail ?? '');
  const [sid, setSid] = useState(useAppStore.getState().studentId ?? '');
  const [showMissing, setShowMissing] = useState(false);

  const identity = { name, email, studentId: sid };
  const missing = missingIdentityFields(identity);
  const roomName = language === 'en' ? room.service : room.nameCs;
  const start = new Date(slotIso);
  const when = `${start.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'numeric' })} · ${start.getHours()}:00`;

  const submit = () => {
    if (missing.length) return setShowMissing(true);
    void bookRoom(room, slotIso, identity);
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    fieldKey: 'name' | 'email' | 'studentId',
    type = 'text'
  ) => (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-base-content/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => set(e.target.value)}
        className={`input input-bordered input-sm w-full ${showMissing && missing.includes(fieldKey) ? 'input-error' : ''}`}
      />
    </label>
  );

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm space-y-3">
        <div>
          <h3 className="font-bold text-base-content">{t('map.libraryBookConfirmTitle')}</h3>
          <p className="text-sm text-base-content/60">
            {roomName} · {when}
          </p>
        </div>

        {status === 'success' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <Check size={18} strokeWidth={3} aria-hidden="true" />
              <span className="font-semibold">{t('map.libraryBookSuccess')}</span>
            </div>
            <button type="button" className="btn btn-primary btn-sm btn-block" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            {field(t('map.libraryBookName'), name, setName, 'name')}
            {field(t('map.libraryBookEmail'), email, setEmail, 'email', 'email')}
            {field(t('map.libraryBookStudentId'), sid, setSid, 'studentId')}

            {showMissing && missing.length > 0 && (
              <p className="text-xs text-error">{t('map.libraryBookMissing')}</p>
            )}
            {status === 'error' && error && (
              <p className="text-xs text-error">{t(ERROR_KEY[error])}</p>
            )}

            <p className="flex items-start gap-1.5 text-[11px] text-base-content/50">
              <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              {t('map.libraryBookRealNote')}
            </p>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={status === 'submitting'}
                onClick={submit}
              >
                {status === 'submitting' && <span className="loading loading-spinner loading-xs" />}
                {t('map.libraryBookConfirmCta')}
              </button>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="modal-backdrop"
        aria-label={t('common.cancel')}
        onClick={onClose}
      />
    </div>
  );
}
