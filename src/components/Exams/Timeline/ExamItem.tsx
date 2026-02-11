import React from 'react';
import type { ExamTerm } from '../../../types/exams';
import { useTranslation } from '../../../hooks/useTranslation';

interface ExamItemProps {
  term: ExamTerm;
  subjectName: string;
  isFirst?: boolean;
  isLast?: boolean;
  orientation?: 'vertical' | 'horizontal';
  onClick?: () => void;
}

interface ContentBoxProps {
  subjectName: string;
  term: ExamTerm;
  isHorizontal: boolean;
  onClick?: () => void;
  t: { (key: string): string; language: string };
}

const ContentBox: React.FC<ContentBoxProps> = ({
  subjectName,
  term,
  isHorizontal,
  onClick,
  t,
}) => (
  <div 
    className={`
      shadow-[0_0_20px_rgba(0,0,0,0.3)] border border-base-content/5 p-3 min-w-[200px] bg-base-100 rounded-lg
      transition-all duration-200
      ${!isHorizontal ? 'timeline-box' : ''}
      ${onClick ? 'cursor-pointer hover:bg-base-200/50 active:scale-[0.98]' : ''}
    `}
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-4 mb-1">
      <div className="font-black tracking-tight text-base-content text-sm leading-tight">
        {subjectName}
      </div>
      <div className="text-[12px] font-bold text-primary flex items-center gap-1 mt-0.5 whitespace-nowrap">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
        {t.language === 'en' && term.roomEn ? term.roomEn : (term.roomCs || term.room) || t('common.loading')}
      </div>
    </div>
    <div className="text-[11px] font-mono font-extrabold tracking-widest uppercase text-primary">
      {term.date} • {term.time}
    </div>
  </div>
);

const ExamItem: React.FC<ExamItemProps> = ({
  term,
  subjectName,
  isFirst,
  isLast,
  orientation = 'vertical',
  onClick,
}) => {
  const { t } = useTranslation();
  const isHorizontal = orientation === 'horizontal';

  // Neutral Track and Dot coloring
  const hrClass = 'bg-base-300 opacity-30 hidden'; // Hidden for test
  const iconClass = 'text-base-content opacity-40 invisible'; // Invisible for test

  if (isHorizontal) {
    return (
      <div className="flex-shrink-0">
        <ContentBox 
          subjectName={subjectName} 
          term={term} 
          isHorizontal={isHorizontal} 
          onClick={onClick} 
          t={t} 
        />
      </div>
    );
  }

  return (
    <li>
      {!isFirst && <hr className={hrClass} />}
      
      {/* All boxes in timeline-start for 2-row compact layout */}
      <div className="timeline-start md:text-end mb-10 px-4">
        <ContentBox 
          subjectName={subjectName} 
          term={term} 
          isHorizontal={isHorizontal} 
          onClick={onClick} 
          t={t} 
        />
      </div>

      <div className="timeline-middle">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`${iconClass} h-5 w-5`}
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {!isLast && <hr className={hrClass} />}
    </li>
  );
};

export default ExamItem;
