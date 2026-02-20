import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface StudyJamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudyJamModal({ isOpen, onClose }: StudyJamModalProps) {
  const [state, setState] = useState<'pitch' | 'success'>('pitch');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const suggestion = useAppStore(s => s.selectedStudyJamSuggestion);
  const optInStudyJam = useAppStore(s => s.optInStudyJam);
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
            className="w-full max-w-[480px] bg-[#1c2128] rounded-3xl shadow-2xl border border-white/10 overflow-hidden relative z-10"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
              <h3 className="font-semibold text-lg text-white">
                reIS doučování — {suggestion.courseName}
              </h3>
              <button onClick={handleClose} className="btn btn-sm btn-ghost btn-circle text-gray-400 hover:text-white">
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
                    <div className="space-y-4 text-[14px] text-gray-300 leading-relaxed">
                      {isTutor ? (
                        <>
                          <p>Nechceš některého z prváků zachránit před jistou zkázou?</p>
                          <ul className="list-disc pl-5 space-y-2 marker:text-gray-500">
                            <li>Vysvětlování látky zvyšuje tvoje udržení znalostí o <strong>72%</strong></li>
                            <li>Stačí <strong>jedna hodina</strong></li>
                          </ul>
                          <p>Spárujeme tě s někým, kdo potřebuje pomoc. Když vám to oběma sedne, můžete se domluvit na další.</p>
                        </>
                      ) : (
                        <>
                          <p>Máme studenty, kteří {suggestion.courseName} zvládli a chtějí pomoct.</p>
                          <ul className="list-disc pl-5 space-y-2 marker:text-gray-500">
                            <li>Spárujeme tě s tutorem <strong>zdarma</strong></li>
                            <li>Stačí <strong>jedna hodina</strong></li>
                          </ul>
                          <p>Přihlásíš se a my tě spojíme s někým, kdo ti pomůže.</p>
                        </>
                      )}
                    </div>

                    <button
                      onClick={handleOptIn}
                      disabled={isSubmitting}
                      className="btn btn-primary w-full text-white font-bold h-12 rounded-xl border-none mt-2"
                    >
                      {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : 'Jdu do toho!'}
                    </button>
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
                      <h2 className="text-2xl font-bold text-white mb-2">Super, díky!</h2>
                      <p className="text-gray-400">
                        {isTutor
                          ? 'Jakmile najdeme tutea, dáme ti vědět!'
                          : 'Jakmile tě spárujeme s tutorem, dáme ti vědět!'}
                      </p>
                    </div>
                    <button onClick={handleClose} className="btn btn-ghost w-full text-white border-white/10">
                      Zavřít
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
