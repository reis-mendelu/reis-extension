import { Calendar, Clock, MapPin } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import type { useExamActions } from '../../ExamPanel/useExamActions';

export interface ConfirmSheetProps {
    pendingAction: ReturnType<typeof useExamActions>['pendingAction'];
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Confirms exam register/unregister. Driven directly by `useExamActions`'s
 * `pendingAction` rather than the store's sheet stack — `SheetHost` doesn't
 * exist until Task 14, and this reuses desktop's whole action lifecycle
 * (including the register-after-unregister term-switch + rollback case), so
 * there is nothing here to duplicate. The store's `MobileSheet` 'confirm'
 * member is left unused for now.
 */
export function ConfirmSheet({ pendingAction, onConfirm, onCancel }: ConfirmSheetProps) {
    const { t } = useTranslation();
    if (!pendingAction) return null;

    const isRegister = pendingAction.type === 'register';
    const { section } = pendingAction;
    const term = isRegister
        ? section.terms.find((candidate) => candidate.id === pendingAction.termId)
        : section.registeredTerm;

    return (
        <Sheet size="content" onClose={onCancel} elevated>
            <SheetHeader
                title={isRegister ? t('exams.confirmation.registerTitle') : t('exams.confirmation.unregisterTitle')}
                onClose={onCancel}
            />
            <div className="flex flex-col gap-3 px-4 pb-5">
                <p className="text-xs text-content-secondary">
                    {isRegister ? t('exams.confirmation.registerBody') : t('exams.confirmation.unregisterBody')}
                </p>
                <div className="flex flex-col gap-2 rounded-xl bg-base-200 p-3">
                    <span className="text-sm font-semibold text-content-primary">{section.name}</span>
                    {term && (
                        <div className="flex flex-col gap-1.5 text-xs text-content-secondary">
                            {term.date && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={13} className="text-content-muted" />
                                    {term.date}
                                </span>
                            )}
                            {term.time && (
                                <span className="flex items-center gap-1.5">
                                    <Clock size={13} className="text-content-muted" />
                                    {term.time}
                                </span>
                            )}
                            {term.room && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin size={13} className="text-content-muted" />
                                    {term.room}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="min-h-11 flex-1 rounded-xl border border-base-300 text-sm font-semibold text-content-secondary"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${
                            isRegister ? 'bg-primary text-primary-content' : 'bg-error text-error-content'
                        }`}
                    >
                        {isRegister ? t('mobile.exams.register') : t('mobile.exams.unregister')}
                    </button>
                </div>
            </div>
        </Sheet>
    );
}
