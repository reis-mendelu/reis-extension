import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';

export function LATableA() {
  const { t } = useTranslation();
  const courses = useAppStore(s => s.erasmusTableACourses);
  const addCourse = useAppStore(s => s.addErasmusTableACourse);
  const removeCourse = useAppStore(s => s.removeErasmusTableACourse);

  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('');

  const handleAdd = () => {
    const c = parseInt(credits, 10);
    if (!code.trim() || !name.trim() || isNaN(c) || c <= 0) return;
    addCourse({ code: code.trim(), name: name.trim(), credits: c });
    setCode('');
    setName('');
    setCredits('');
    setAdding(false);
  };

  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <div className="badge badge-sm font-black tracking-wider bg-primary/10 text-primary border-primary/20">A</div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/50">
          {t('erasmus.tableATitle')}
        </span>
      </div>

      <div className="border border-base-300 rounded-xl overflow-hidden bg-base-100 shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 bg-base-200/50 border-b border-base-300 text-[10px] uppercase tracking-wider font-bold text-base-content/40">
          <span className="w-20">{t('erasmus.colCode')}</span>
          <span>{t('erasmus.colCourse')}</span>
          <span className="w-12 text-right">{t('erasmus.colECTS')}</span>
          <span className="w-5" />
        </div>

        {/* Courses */}
        {courses.map((course, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 border-b border-base-300/50 text-xs hover:bg-base-200/30 transition-colors"
          >
            <span className="font-mono text-base-content/50 w-20 truncate">{course.code}</span>
            <span className="truncate font-medium">{course.name}</span>
            <span className="tabular-nums font-bold text-base-content/70 w-12 text-right">{course.credits}</span>
            <button
              onClick={() => removeCourse(i)}
              className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/15 hover:text-error hover:bg-error/10 rounded-full"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Add row form */}
        {adding ? (
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 border-b border-base-300/50 bg-base-200/20">
            <input
              autoFocus
              className="input input-xs input-bordered w-20 font-mono text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              placeholder={t('erasmus.colCode')}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="input input-xs input-bordered w-full text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              placeholder={t('erasmus.colCourse')}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="input input-xs input-bordered w-12 text-xs text-right tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              placeholder="0"
              value={credits}
              onChange={e => setCredits(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={() => setAdding(false)}
              className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/30 hover:text-error rounded-full"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-base-content/30 hover:text-primary hover:bg-base-200/30 transition-colors w-full border-b border-base-300/50"
          >
            <Plus size={12} />
            <span>{t('erasmus.addCourse')}</span>
          </button>
        )}

        {/* Total */}
        {courses.length > 0 && (
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 bg-base-200/30 text-xs">
            <span className="font-bold text-base-content/50 w-20">{t('erasmus.total')}</span>
            <span />
            <span className="tabular-nums font-black w-12 text-right">{totalCredits}</span>
            <span className="w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
