import { useTranslation } from '../../hooks/useTranslation';

export type ReportType = 'bug' | 'idea' | 'other';

interface Props {
  type: ReportType;
  setType: (t: ReportType) => void;
  title: string;
  setTitle: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  contact: string;
  setContact: (v: string) => void;
  /** Enter in the title or contact field; the modal decides whether it sends. */
  onEnter: (e: React.KeyboardEvent) => void;
}

/** The report form's type picker and its three text fields. State lives in FeedbackModal. */
export function ReportFormFields({
  type,
  setType,
  title,
  setTitle,
  message,
  setMessage,
  contact,
  setContact,
  onEnter,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      {/* Type Selection */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-base-content/60 ml-1">
          {t('feedback.typeLabel')}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setType('bug')}
            className={`btn btn-sm border-0 ${type === 'bug' ? 'bg-error/20 text-base-content hover:bg-error/30' : 'bg-base-200 text-base-content/75 hover:bg-base-300 hover:text-base-content'}`}
          >
            {t('feedback.bug')}
          </button>
          <button
            type="button"
            onClick={() => setType('idea')}
            className={`btn btn-sm border-0 ${type === 'idea' ? 'bg-warning/20 text-base-content hover:bg-warning/30' : 'bg-base-200 text-base-content/75 hover:bg-base-300 hover:text-base-content'}`}
          >
            {t('feedback.idea')}
          </button>
          <button
            type="button"
            onClick={() => setType('other')}
            className={`btn btn-sm border-0 ${type === 'other' ? 'bg-neutral text-neutral-content hover:bg-neutral/80' : 'bg-base-200 text-base-content/75 hover:bg-base-300 hover:text-base-content'}`}
          >
            {t('feedback.other')}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="form-control">
        <label className="label pt-0 pb-1">
          <span className="text-sm font-medium text-base-content/60">{t('feedback.subject')}</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('feedback.subjectPlaceholder')}
          className="input input-bordered w-full bg-base-200 border-base-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 text-base-content transition-colors"
          required
          maxLength={120}
          onKeyDown={onEnter}
        />
      </div>

      {/* Message */}
      <div className="form-control">
        <label className="label pt-0 pb-1">
          <span className="text-sm font-medium text-base-content/60">
            {t('feedback.description')}
          </span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('feedback.descriptionPlaceholder')}
          className="textarea textarea-bordered h-32 w-full bg-base-200 border-base-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 text-base-content transition-colors leading-relaxed resize-none"
          required
          maxLength={2000}
          aria-describedby={type === 'bug' ? 'feedback-bug-hint' : undefined}
        />
        {/* Visible text, not a placeholder: that vanishes as soon as
              they type. Only for Chyba — ideas arrive understandable. */}
        {type === 'bug' && (
          <p
            id="feedback-bug-hint"
            className="mt-1.5 ml-1 text-xs leading-snug text-base-content/70"
          >
            {t('feedback.bugHint')}
          </p>
        )}
      </div>

      {/* Contact (Optional) */}
      <div className="form-control">
        {/* whitespace-normal: daisyUI's .label never wraps, and this
              one says why we ask, which is longer than a word. */}
        <label className="label pt-0 pb-1 whitespace-normal">
          <span className="text-sm font-medium text-base-content/60">{t('feedback.contact')}</span>
        </label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t('feedback.contactPlaceholder')}
          className="input input-bordered w-full bg-base-200 border-base-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 text-base-content transition-colors"
          onKeyDown={onEnter}
        />
      </div>
    </>
  );
}
