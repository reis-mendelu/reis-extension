/**
 * ConfirmationModal Component
 * 
 * DaisyUI modal for confirming exam registration/deregistration actions.
 */

import { CheckCircle, XCircle, Calendar, Clock, MapPin } from 'lucide-react';

interface TermInfo {
    date?: string;
    time?: string;
    room?: string;
}

interface ConfirmationModalProps {
    isOpen: boolean;
    actionType: 'register' | 'unregister';
    sectionName: string;
    termInfo?: TermInfo;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationModal({
    isOpen,
    actionType,
    sectionName,
    termInfo,
    onConfirm,
    onCancel
}: ConfirmationModalProps) {
    const isRegister = actionType === 'register';

    return (
        <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
            <div className="modal-box">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    {isRegister ? (
                        <>
                            <CheckCircle className="text-success" size={24} />
                            Potvrdit přihlášení
                        </>
                    ) : (
                        <>
                            <XCircle className="text-error" size={24} />
                            Potvrdit odhlášení
                        </>
                    )}
                </h3>
                
                <div className="py-4">
                    <p className="text-base-content/70 mb-4">
                        {isRegister 
                            ? 'Opravdu se chcete přihlásit na tento termín zkoušky?' 
                            : 'Opravdu se chcete odhlásit z této zkoušky?'}
                    </p>
                    
                    <div className="bg-base-200 rounded-lg p-4">
                        <div className="font-semibold text-base-content mb-2">
                            {sectionName}
                        </div>
                        
                        {termInfo && (
                            <div className="flex flex-col gap-1.5 text-sm text-base-content/70">
                                {termInfo.date && (
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-base-content/50" />
                                        <span>{termInfo.date}</span>
                                    </div>
                                )}
                                {termInfo.time && (
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-base-content/50" />
                                        <span>{termInfo.time}</span>
                                    </div>
                                )}
                                {termInfo.room && (
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-base-content/50" />
                                        <span>{termInfo.room}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onCancel}>
                        Zrušit
                    </button>
                    <button 
                        className={isRegister ? "btn btn-success" : "btn btn-error"}
                        onClick={onConfirm}
                    >
                        {isRegister ? 'Přihlásit se' : 'Odhlásit se'}
                    </button>
                </div>
            </div>
            
            {/* Backdrop that closes modal on click */}
            <form method="dialog" className="modal-backdrop">
                <button onClick={onCancel}>close</button>
            </form>
        </dialog>
    );
}
