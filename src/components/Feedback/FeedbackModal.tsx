import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { DISCORD_WEBHOOK_URL } from '../../constants/config';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'idea' | 'other'>('bug');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setIsSending(true);

    const contextData = {
      version: '4.0.0', // Updated for next release
      url: window.location.href,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`
    };

    const payload = {
      username: "reIS Feedback Bot",
      avatar_url: "https://is.mendelu.cz/auth/images/logo_mendelu.png", // Using university logo
      thread_name: `[${type.toUpperCase()}] ${title}`, // For Forum Channels
      content: `**Typ:** ${type}\n**Kontakt:** ${contact || 'N/A'}\n**Zpráva:**\n${message}\n\n__Technické info:__\n\`\`\`json\n${JSON.stringify(contextData, null, 2)}\n\`\`\``
    };

    try {
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsSuccess(true);
        toast.success(t('feedback.toastSuccess'));
      } else {
        throw new Error('Failed to send');
      }
    } catch (error) {
      console.error('Feedback error:', error);
      toast.error(t('feedback.toastError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form after delay
    setTimeout(() => {
      setIsSuccess(false);
      setTitle('');
      setMessage('');
      setContact('');
      setType('bug');
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-[#1c2128] rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="font-semibold text-lg text-white">{t('feedback.title')}</h3>
              <button 
                onClick={handleClose}
                className="btn btn-sm btn-ghost btn-circle text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
               {isSuccess ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-2">
                       <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{t('feedback.successTitle')}</h3>
                    <p className="text-gray-400 max-w-xs">
                      {t('feedback.successText')}
                    </p>
                    <button 
                      onClick={handleClose}
                      className="btn btn-primary w-full mt-4"
                    >
                      {t('feedback.close')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    
                    {/* Type Selection */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-400 ml-1">{t('feedback.typeLabel')}</label>
                      <div className="grid grid-cols-3 gap-2">
                         <button
                           type="button"
                           onClick={() => setType('bug')}
                           className={`btn btn-sm border-0 ${type === 'bug' ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-base-200 text-gray-400 hover:bg-base-300 hover:text-white'}`}
                         >
                           {t('feedback.bug')}
                         </button>
                         <button
                           type="button"
                           onClick={() => setType('idea')}
                           className={`btn btn-sm border-0 ${type === 'idea' ? 'bg-warning/20 text-warning hover:bg-warning/30' : 'bg-base-200 text-gray-400 hover:bg-base-300 hover:text-white'}`}
                         >
                           {t('feedback.idea')}
                         </button>
                         <button
                           type="button"
                           onClick={() => setType('other')}
                           className={`btn btn-sm border-0 ${type === 'other' ? 'bg-neutral text-white hover:bg-neutral-focus' : 'bg-base-200 text-gray-400 hover:bg-base-300 hover:text-white'}`}
                         >
                           {t('feedback.other')}
                         </button>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="form-control">
                      <label className="label pt-0 pb-1">
                        <span className="text-sm font-medium text-gray-400">{t('feedback.subject')}</span>
                      </label>
                      <input 
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('feedback.subjectPlaceholder')}
                        className="input input-bordered w-full bg-[#0d1117] border-white/10 focus:border-primary focus:outline-none focus:bg-[#0d1117] text-white transition-colors" 
                        required
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      />
                    </div>

                    {/* Message */}
                    <div className="form-control">
                      <label className="label pt-0 pb-1">
                        <span className="text-sm font-medium text-gray-400">{t('feedback.description')}</span>
                      </label>
                      <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t('feedback.descriptionPlaceholder')}
                        className="textarea textarea-bordered h-32 w-full bg-[#0d1117] border-white/10 focus:border-primary focus:outline-none focus:bg-[#0d1117] text-white transition-colors leading-relaxed resize-none" 
                        required
                      />
                    </div>

                    {/* Contact (Optional) */}
                    <div className="form-control">
                      <label className="label pt-0 pb-1">
                        <span className="text-sm font-medium text-gray-400">{t('feedback.contact')}</span>
                      </label>
                      <input 
                        type="text" 
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder={t('feedback.contactPlaceholder')}
                        className="input input-bordered w-full bg-[#0d1117] border-white/10 focus:border-primary focus:outline-none focus:bg-[#0d1117] text-white transition-colors" 
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                       <button 
                        type="button"
                        onClick={handleSubmit} 
                        disabled={isSending || !title || !message}
                        className="btn btn-primary w-full gap-2 font-semibold no-animation text-white"
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {t('feedback.sending')}
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            {t('feedback.submit')}
                          </>
                        )}
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-center text-gray-500 mt-2">
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
