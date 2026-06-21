import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

interface StudyJamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudyJamModal({ isOpen, onClose }: StudyJamModalProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<'pitch' | 'success'>('pitch');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const suggestion = useAppStore(s => s.selectedStudyJamSuggestion);
  const optInStudyJam = useAppStore(s => s.optInStudyJam);
  const dismissSuggestion = useAppStore(s => s.dismissStudyJamSuggestion);
  const setSelected = useAppStore(s => s.setSelectedStudyJamSuggestion);

  const handleClose = () => {
    onClose();
    setSelected(null);
    setTimeout(() => setState('pitch'), 300);
  };

  const handleOptIn = async () => {
    if (!suggestion) return;
    setIsSubmitting(true);
    await optInStudyJam(suggestion.courseCode, suggestion.courseName, suggestion.role);
    setIsSubmitting(false);
    setState('success');
  };

  const handleDismiss = async () => {
    if (!suggestion) return;
    await dismissSuggestion(suggestion.courseCode);
    handleClose();
  };

  const isTutor = suggestion?.role === 'tutor';

  return (
    <AnimatePresence>
      {isOpen && suggestion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-[480px] bg-base-100 rounded-3xl shadow-2xl border border-base-300 overflow-hidden relative z-10"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300/50 bg-base-200/50 backdrop-blur-md">
              <h3 className="font-semibold text-lg text-base-content">
                {t('studyJam.titlePrefix')} — {suggestion.courseName}
              </h3>
              <button onClick={handleClose} aria-label={t('studyJam.close')} className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 py-6">
              <AnimatePresence mode="wait">
                {state === 'pitch' && (
                  <motion.div
                    key="pitch"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col text-left space-y-6"
                  >
                    <div className="space-y-4 text-[14px] text-base-content/80 leading-relaxed">
                      {isTutor ? (
                        <>
                          <p>{t('studyJam.tutorIntro')}</p>
                          <ul className="list-disc pl-5 space-y-2 marker:text-base-content/40">
                            <li>{t('studyJam.tutorBenefitRetention')} <strong>72%</strong></li>
                            <li>{t('studyJam.justNeed')} <strong>{t('studyJam.oneHour')}</strong></li>
                          </ul>
                          <p>{t('studyJam.tutorOutro')}</p>
                        </>
                      ) : (
                        <>
                          <p>{t('studyJam.tuteeIntro', { course: suggestion.courseName })}</p>
                          <ul className="list-disc pl-5 space-y-2 marker:text-base-content/40">
                            <li>{t('studyJam.tuteeBenefitPair')} <strong>{t('studyJam.free')}</strong></li>
                            <li>{t('studyJam.justNeed')} <strong>{t('studyJam.oneHour')}</strong></li>
                          </ul>
                          <p>{t('studyJam.tuteeOutro')}</p>
                        </>
                      )}
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button
                          onClick={handleDismiss}
                          className="btn bg-base-300 hover:bg-base-200 text-base-content border-none flex-1 h-12 rounded-xl"
                        >
                          {t('studyJam.decline')}
                        </button>
                        <button
                          onClick={handleOptIn}
                          disabled={isSubmitting}
                          className="btn btn-primary flex-[1.5] font-bold h-12 rounded-xl"
                        >
                          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : t('studyJam.optIn')}
                        </button>
                    </div>
                  </motion.div>
                )}

                {state === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-center space-y-6 py-4"
                  >
                    <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center text-success mb-2">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-base-content mb-2">{t('studyJam.successTitle')}</h2>
                      <p className="text-base-content/60">
                        {isTutor ? t('studyJam.successTutor') : t('studyJam.successTutee')}
                      </p>
                    </div>
                    <button onClick={handleClose} className="btn btn-ghost w-full text-base-content border-base-300">
                      {t('studyJam.close')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
