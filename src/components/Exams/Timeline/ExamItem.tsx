import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ExamTerm } from '../../../types/exams';
import { useTranslation } from '../../../hooks/useTranslation';
import { getDeadlineUrgency, formatDeadlineCountdown } from './TimelineDrawer';

interface ExamItemProps {
  term: ExamTerm;
  subjectName: string;
  sectionName?: string;
  deadline?: string;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  orientation?: 'vertical' | 'horizontal';
  onClick?: () => void;
}

const urgencyBorder = {
  none: 'border-base-content/5',
  warning: 'border-warning/50',
  critical: 'border-error/70',
  expired: 'border-base-content/5',
};

const urgencyBadge = {
  none: null,
  warning: 'bg-warning/10 text-warning border-warning/20',
  critical: 'bg-error/10 text-error border-error/20 animate-pulse',
  expired: null,
};

interface ContentBoxProps {
  subjectName: string;
  sectionName?: string;
  term: ExamTerm;
  deadline?: string;
  isHorizontal: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  t: (key: string) => string;
  language?: string;
}

const ContentBox: React.FC<ContentBoxProps> = ({ subjectName, sectionName, term, deadline, isHorizontal, isSelected, onClick, t, language }) => {
  const urgency = getDeadlineUrgency(deadline);
  const countdown = deadline && urgency !== 'none' && urgency !== 'expired' ? formatDeadlineCountdown(deadline) : null;
  const badgeClass = urgencyBadge[urgency];

  return (
    <div
      className={`
        shadow-[0_0_20px_rgba(0,0,0,0.3)] border p-3 min-w-[200px] bg-base-100 rounded-lg
        transition-all duration-200
        ${urgencyBorder[urgency]}
        ${!isHorizontal ? 'timeline-box' : ''}
        ${isSelected ? 'ring-1 ring-primary/40 bg-base-200/40' : ''}
        ${onClick ? 'cursor-pointer hover:bg-base-200/50 active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="font-black tracking-tight text-base-content text-sm leading-tight">
            {subjectName}
          </div>
          {sectionName && (
            <div className="text-[10px] font-medium text-base-content/45 uppercase tracking-wide leading-none">
              {sectionName}
            </div>
          )}
        </div>
        <div className="text-[12px] font-bold text-primary flex items-center gap-1 mt-0.5 whitespace-nowrap">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          {language === 'en' && term.roomEn ? term.roomEn : (term.roomCs || term.room) || t('common.loading')}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-mono font-extrabold tracking-widest uppercase text-primary">
          {term.date} • {term.time}
        </div>
        {countdown && badgeClass && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeClass}`}>
            {countdown}
          </span>
        )}
      </div>
      {onClick && (
        <div className={`flex items-center justify-center mt-2 pt-1.5 border-t transition-colors ${isSelected ? 'border-primary/20 text-primary' : 'border-base-content/8 text-base-content/25 hover:text-base-content/50'}`}>
          {isSelected
            ? <ChevronUp size={13} />
            : <ChevronDown size={13} />}
        </div>
      )}
    </div>
  );
};

interface CompactCardProps {
  subjectName: string;
  sectionName?: string;
  term: ExamTerm;
  deadline?: string;
  isSelected?: boolean;
  onClick?: () => void;
  t: (key: string) => string;
  language?: string;
}

const CompactCard: React.FC<CompactCardProps> = ({ subjectName, sectionName, term, deadline, isSelected, onClick, language }) => {
  const urgency = getDeadlineUrgency(deadline);
  const countdown = deadline && urgency !== 'none' && urgency !== 'expired' ? formatDeadlineCountdown(deadline) : null;
  const badgeClass = urgencyBadge[urgency];

  return (
    <div
      className={`
        border px-2.5 py-1.5 w-full h-full bg-base-100 rounded-md
        transition-all duration-200
        ${urgencyBorder[urgency]}
        ${isSelected ? 'ring-1 ring-primary/40 bg-base-200/40' : ''}
        ${onClick ? 'cursor-pointer hover:bg-base-200/50 active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
    >
      <div className="font-black text-[11px] leading-tight truncate text-base-content">{subjectName}</div>
      {sectionName && (
        <div className="text-[9px] font-medium text-base-content/40 uppercase tracking-wide truncate leading-none mt-0.5">{sectionName}</div>
      )}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <div className="text-[10px] font-mono font-bold text-primary leading-none whitespace-nowrap">
          {term.date} · {term.time}
        </div>
        {countdown && badgeClass && (
          <span className={`text-[9px] font-bold px-1 py-px rounded border ${badgeClass} leading-none`}>{countdown}</span>
        )}
      </div>
    </div>
  );
};

const ExamItem: React.FC<ExamItemProps> = ({ term, subjectName, sectionName, deadline, isSelected, isFirst, isLast, orientation = 'vertical', onClick }) => {
  const { t, language } = useTranslation();
  const isHorizontal = orientation === 'horizontal';
  const hrClass = 'bg-base-300 opacity-30 hidden';
  const iconClass = 'text-base-content opacity-40 invisible';

  if (isHorizontal) {
    const urgency = getDeadlineUrgency(deadline);
    const dotColor = isSelected
      ? 'bg-primary ring-2 ring-primary/30 scale-110'
      : urgency === 'critical'
      ? 'bg-error animate-pulse'
      : urgency === 'warning'
      ? 'bg-warning'
      : 'bg-base-content/40';

    return (
      <div className="flex-shrink-0 flex flex-col items-center w-40">
        <div className="px-1.5 w-full flex-1 flex">
          <CompactCard subjectName={subjectName} sectionName={sectionName} term={term} deadline={deadline} isSelected={isSelected} onClick={onClick} t={t} language={language} />
        </div>
        <div className="w-px flex-1 min-h-[10px] bg-base-content/15" />
        <div className="h-2 flex items-center justify-center shrink-0">
          <div className={`w-2 h-2 rounded-full transition-all duration-200 ${dotColor}`} />
        </div>
      </div>
    );
  }

  return (
    <li>
      {!isFirst && <hr className={hrClass} />}
      <div className="timeline-start md:text-end mb-10 px-4">
        <ContentBox subjectName={subjectName} sectionName={sectionName} term={term} deadline={deadline} isHorizontal={false} isSelected={isSelected} onClick={onClick} t={t} language={language} />
      </div>
      <div className="timeline-middle">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`${iconClass} h-5 w-5`}>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
      </div>
      {!isLast && <hr className={hrClass} />}
    </li>
  );
};

export default ExamItem;
