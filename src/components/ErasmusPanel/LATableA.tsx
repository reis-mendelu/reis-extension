import { useState, useRef } from 'react';
import { Plus, X, Globe, Link, Hash, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { LATableB } from './LATableB';
import { UnfulfilledCoursesSection } from './UnfulfilledCoursesSection';
import { ErasmusVerifyDot } from './ErasmusVerifyDot';
import { CountryPicker } from './CountryPicker';
import type { ErasmusUniversityOption } from '@/store/types';
import type { StudyPlan } from '@/types/studyPlan';

interface OptionProps {
  option: ErasmusUniversityOption;
  index: number;
  total: number;
  selectedCodes: string[];
  onToggle: (code: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  plan: StudyPlan;
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
  onViewReports: (file: string, schoolName: string | null, isPermanent?: boolean) => void;
}

function LATableAOption({ option, index, total, selectedCodes, onToggle, onReorder, plan, onOpenSubject, onSearchSubject, onViewReports }: OptionProps) {
  const { t } = useTranslation();
  const updateHeader = useAppStore(s => s.updateErasmusTableAOptionHeader);
  const removeOption = useAppStore(s => s.removeErasmusTableAOption);
  const addCourse = useAppStore(s => s.addErasmusTableACourse);
  const removeCourse = useAppStore(s => s.removeErasmusTableACourse);
  const reorderCourseA = useAppStore(s => s.reorderErasmusTableACourse);

  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const handleAddCourse = () => {
    const c = parseInt(credits, 10) || 0;
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode && !trimmedName && c <= 0) {
      codeInputRef.current?.focus();
      return;
    }
    addCourse(option.id, { code: trimmedCode, name: trimmedName, credits: c });
    setCode('');
    setName('');
    setCredits('');
    codeInputRef.current?.focus();
  };

  const totalCredits = option.courses.reduce((sum, c) => sum + c.credits, 0);

  return (
    <div className="flex flex-col gap-3 group/option">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="badge badge-sm font-black tracking-wider bg-primary/10 text-primary border-primary/20">
            {index + 1}
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/50">
            {t('erasmus.receivingInstitution')}
          </span>
        </div>
        {total > 1 && (
          <button
            onClick={() => removeOption(option.id)}
            className="btn btn-ghost btn-xs text-base-content/20 hover:text-error opacity-0 group-hover/option:opacity-100 transition-opacity"
            title="Remove option"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm flex flex-col">
        {/* Institution header */}
        <div className="p-4 flex flex-col gap-3 border-b border-base-300/50 bg-base-200/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-base-content/40 ml-1">
                {t('erasmus.institution')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input input-sm input-bordered w-full pl-8 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="University of Maribor"
                  value={option.institutionName}
                  onChange={e => updateHeader(option.id, { institutionName: e.target.value })}
                />
                <Globe size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-base-content/40 ml-1">
                {t('erasmus.erasmusCode')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input input-sm input-bordered w-full pl-8 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="SI MARIBOR01"
                  value={option.erasmusCode}
                  onChange={e => updateHeader(option.id, { erasmusCode: e.target.value })}
                />
                <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-base-content/40 ml-1">
                {t('erasmus.country')}
              </label>
              <div className="relative">
                <CountryPicker
                  value={option.country}
                  onChange={val => updateHeader(option.id, { country: val })}
                  onViewReports={(file, school) => onViewReports(file, school, true)}
                  placeholder="Slovenia"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-base-content/40 ml-1">
                {t('erasmus.courseCatalogue')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input input-sm input-bordered w-full pl-8 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="https://..."
                  value={option.link}
                  onChange={e => updateHeader(option.id, { link: e.target.value })}
                />
                <Link size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30" />
              </div>
            </div>
          </div>
        </div>

        {/* Table A label */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-base-300/60">
          <div className="badge badge-sm font-black tracking-wider bg-primary/10 text-primary border-primary/20">A</div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/50">
            {t('erasmus.tableATitle')}
          </span>
        </div>

        {/* Table A header */}
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-2 px-3 py-2 bg-base-200/50 border-b border-base-300 text-[10px] uppercase tracking-wider font-bold text-base-content/40">
          <span className="w-4" />
          <span className="w-20">{t('erasmus.colCode')}</span>
          <span>{t('erasmus.colCourse')}</span>
          <span className="w-12 text-right">{t('erasmus.colECTS')}</span>
          <span className="w-4" />
          <span className="w-5" />
        </div>

        {/* Table A courses */}
        {option.courses.map((course, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredRowIndex(i)}
            onMouseLeave={() => setHoveredRowIndex(null)}
            className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-2 items-center px-3 py-2 border-b border-base-300/50 text-xs hover:bg-base-200/50 transition-colors"
          >
            <div className="flex flex-col gap-0">
              <button
                onClick={() => reorderCourseA(option.id, i, i - 1)}
                disabled={i === 0}
                className="btn btn-ghost w-4 h-3.5 min-h-0 p-0 text-base-content/20 hover:text-primary disabled:opacity-0 disabled:pointer-events-none rounded-none"
              >
                <ChevronUp size={11} />
              </button>
              <button
                onClick={() => reorderCourseA(option.id, i, i + 1)}
                disabled={i === option.courses.length - 1}
                className="btn btn-ghost w-4 h-3.5 min-h-0 p-0 text-base-content/20 hover:text-primary disabled:opacity-0 disabled:pointer-events-none rounded-none"
              >
                <ChevronDown size={11} />
              </button>
            </div>
            <span className="font-mono text-base-content/50 w-20 truncate">{course.code}</span>
            <span className="truncate font-medium">{course.name}</span>
            <span className="tabular-nums font-bold text-base-content/70 w-12 text-right">{course.credits}</span>
            <ErasmusVerifyDot
              courseCode={course.code}
              courseName={course.name}
              optionId={option.id}
              plan={plan}
              rowIndex={i}
            />
            <button
              onClick={() => removeCourse(option.id, i)}
              className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/15 hover:text-error hover:bg-error/10 rounded-full"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Add row form */}
        {adding && (
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 border-b border-base-300/50 bg-base-200/20">
            <input
              ref={codeInputRef}
              autoFocus
              className="input input-xs input-bordered w-20 font-mono text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              placeholder={t('erasmus.colCode')}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCourse()}
            />
            <input
              className="input input-xs input-bordered w-full text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              placeholder={t('erasmus.colCourse')}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCourse()}
            />
            <input
              className="input input-xs input-bordered w-12 text-xs text-right tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              placeholder="0"
              value={credits}
              onChange={e => setCredits(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleAddCourse()}
            />
            <button
              onClick={() => setAdding(false)}
              className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/30 hover:text-error rounded-full"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Add course button */}
        <button
          onClick={() => (adding ? handleAddCourse() : setAdding(true))}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-primary hover:bg-primary/10 transition-colors w-full border-b border-base-300/50 font-bold"
        >
          <Plus size={12} />
          <span>{t('erasmus.addCourse')}</span>
        </button>

        {/* Table A total */}
        {option.courses.length > 0 && (
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-2 items-center px-3 py-2 bg-base-200/30 text-xs border-b border-base-300/50">
            <span className="w-4" />
            <span className="font-bold text-base-content/50 w-20">{t('erasmus.total')}</span>
            <span />
            <span className="tabular-nums font-black w-12 text-right">{totalCredits}</span>
            <span className="w-4" />
            <span className="w-5" />
          </div>
        )}
      </div>

      {/* Table B */}
      <LATableB plan={plan} selectedCodes={selectedCodes} onToggle={onToggle} tableACourses={option.courses} onReorder={onReorder} hoveredRowIndex={hoveredRowIndex} />

      {/* Add courses picker */}
      <div className="flex flex-col gap-0">
        <button
          onClick={() => setBuilderOpen(!builderOpen)}
          className="flex items-center gap-2 px-2 py-2 text-xs font-bold text-base-content/50 hover:text-primary transition-colors group w-full"
        >
          {builderOpen
            ? <ChevronDown size={14} className="transition-transform rotate-180" />
            : <Plus size={14} />
          }
          <span>{t('erasmus.addCourses')}</span>
          {!builderOpen && (
            <span className="text-[10px] font-normal text-base-content/30 ml-1">{t('erasmus.addCoursesHint')}</span>
          )}
        </button>

        {builderOpen && (
          <UnfulfilledCoursesSection
            selectedCodes={selectedCodes}
            onToggle={onToggle}
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
          />
        )}
      </div>
    </div>
  );
}

interface LATableAProps {
  plan: StudyPlan;
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
  onViewReports: (file: string, schoolName: string | null, isPermanent?: boolean) => void;
}

export function LATableA({ plan, onOpenSubject, onSearchSubject, onViewReports }: LATableAProps) {
  const options = useAppStore(s => s.erasmusTableAOptions);
  const tableBCourses = useAppStore(s => s.erasmusTableBCourses);
  const toggleCourse = useAppStore(s => s.toggleErasmusTableBCourse);
  const reorderCourse = useAppStore(s => s.reorderErasmusTableBCourse);

  return (
    <div className="flex flex-col gap-8 pb-4">
      {options.map((option, i) => (
        <LATableAOption
          key={option.id}
          option={option}
          index={i}
          total={options.length}
          selectedCodes={tableBCourses[option.id] ?? []}
          onToggle={(code) => toggleCourse(option.id, code)}
          onReorder={(from, to) => reorderCourse(option.id, from, to)}
          plan={plan}
          onOpenSubject={onOpenSubject}
          onSearchSubject={onSearchSubject}
          onViewReports={onViewReports}
        />
      ))}
    </div>
  );
}
