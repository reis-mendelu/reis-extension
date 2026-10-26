import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';
import { submitSuggestion } from '../../api/suggestions';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { logError } from '../../utils/reportError';
import { feedbackErrorKey } from './feedbackErrorKey';
import { useAppStore } from '../../store/useAppStore';
import { useCloseReport } from './useCloseReport';
import { desktopDialogMotion, phoneSheetMotion } from './feedbackModalMotion';
import { useReportAttachments } from './useReportAttachments';
import { ReportAttachments } from './ReportAttachments';
import { ReportSendButtons } from './ReportSendButtons';
import { ReportFormFields, type ReportType } from './ReportFormFields';
import { requestDataConsent, reportConsentCategories } from '../../utils/firefoxDataConsent';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Our own prefill (an entry point's key), never IS text. Read once per mount. */
  initialTitle?: string;
}

export function FeedbackModal({ isOpen, onClose, initialTitle }: FeedbackModalProps) {
  const [type, setType] = useState<ReportType>('bug');
  const [title, setTitle] = useState(initialTitle ?? '');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { t } = useTranslation();
  const attachments = useReportAttachments();
  // Phones get a bottom sheet, not a centred dialog: a floating card with a
  // blurred backdrop is a desktop idiom, and every other mobile surface here
  // rises from the bottom edge.
  const isPhone = useAppStore((s) => s.isTouch && s.isNarrow);
  // No field is focused on open, on any device. The student first picks
  // Chyba/Nápad/Jiné, and on a phone a focused field raised the soft keyboard
  // mid-slide, resized the WebView and made the sheet jump.

  const isBug = type === 'bug';

  const handleSubmit = async (withDiagnostics: boolean) => {
    // The Send button's `disabled` is not the only entry point: Enter in the
    // title or contact field calls this directly. Without its own check, Enter
    // on a half-filled form posts an empty body, the function 400s it, and the
    // student sees the generic failure toast for input the UI should have
    // caught. Trimmed, so whitespace does not count as filled in either.
    if (isSending || attachments.encoding || !title.trim() || !message.trim()) return;
    // Firefox only (a no-op everywhere else): consent for exactly what this
    // report carries. Called BEFORE any await — Firefox honours
    // permissions.request only while it is handling the click.
    const consent = requestDataConsent(
      reportConsentCategories({
        contact,
        screenshot: attachments.screenshot !== null,
        diagnostics: withDiagnostics,
      })
    );
    setIsSending(true);

    // Context (screen, version, browser, viewport) is assembled in the API
    // layer. Deliberately no window.location.href: on IS it carries
    // studium=/obdobi=/predmet=/termin=.
    // NOTE the rename: SuggestionDraft's field is `body`, the component's state
    // variable is `message`.
    // try/finally is the safety net: submitSuggestion catches internally and
    // resolves { ok: false, error: 'offline' } today, but if that invariant
    // ever breaks, an unexpected rejection must not leave the Send button
    // stuck on "Sending…" with the user's text trapped behind it.
    try {
      if (!(await consent)) {
        toast.error(t('feedback.consentDeclined'));
        return;
      }
      const result = await submitSuggestion(
        { type, title, body: message, contact },
        await attachments.draft(withDiagnostics)
      );

      if (result.ok) {
        setIsSuccess(true);
        toast.success(t('feedback.toastSuccess'));
        if (result.screenshotDropped) toast.warning(t('feedback.screenshotDropped'));
      } else {
        toast.error(t(feedbackErrorKey(result.error)));
      }
    } catch (err) {
      logError('FeedbackModal.handleSubmit', err);
      toast.error(t(feedbackErrorKey(undefined)));
    } finally {
      setIsSending(false);
    }
  };

  // Enter sends a Nápad or Jiné as the box says. A Chyba waits for one of its
  // two buttons: the log goes only with the one that says so.
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isBug) void handleSubmit(attachments.includeDiagnostics);
  };

  // Typed text or a screenshot, not yet sent: Escape keeps it (useCloseReport).
  const hasDraft =
    !isSuccess &&
    (attachments.screenshot !== null ||
      [message, contact, title === (initialTitle ?? '') ? '' : title].some((v) => v.trim()));
  const handleClose = useCloseReport(isOpen, onClose, hasDraft);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 z-[60] flex justify-center ${
            isPhone ? 'items-end px-0' : 'items-center px-4'
          }`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            {...(isPhone ? phoneSheetMotion : desktopDialogMotion)}
            className={`w-full bg-base-100 shadow-2xl border-base-300 overflow-hidden relative z-10 ${
              isPhone
                ? 'max-w-none rounded-t-[20px] border-t max-h-[85dvh] overflow-y-auto'
                : 'max-w-md rounded-2xl border max-h-[90dvh] overflow-y-auto'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300/50">
              <h3 className="font-semibold text-lg text-base-content">{t('feedback.title')}</h3>
              <button
                onClick={handleClose}
                aria-label={t('feedback.close')}
                className="btn btn-sm btn-ghost btn-circle text-base-content/75 hover:text-base-content"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-success mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-base-content">
                    {t('feedback.successTitle')}
                  </h3>
                  <p className="text-base-content/60 max-w-xs">{t('feedback.successText')}</p>
                  <button onClick={handleClose} className="btn btn-primary w-full mt-4">
                    {t('feedback.close')}
                  </button>
                </div>
              ) : (
                // onPaste on the whole form: a screenshot pasted into any field
                // is attached rather than dropped as text.
                <div className="space-y-4" onPaste={attachments.onPaste}>
                  <ReportFormFields
                    type={type}
                    setType={setType}
                    title={title}
                    setTitle={setTitle}
                    message={message}
                    setMessage={setMessage}
                    contact={contact}
                    setContact={setContact}
                    onEnter={onEnter}
                  />

                  <ReportAttachments
                    state={attachments}
                    showPasteHint={!isPhone}
                    showDiagnosticsBox={!isBug}
                  />

                  <ReportSendButtons
                    isBug={isBug}
                    includeDiagnostics={attachments.includeDiagnostics}
                    isSending={isSending}
                    disabled={isSending || attachments.encoding || !title.trim() || !message.trim()}
                    onSend={(withDiagnostics) => void handleSubmit(withDiagnostics)}
                  />

                  <p className="text-[10px] text-center text-base-content/75 mt-2">
                    {t('feedback.footer')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
