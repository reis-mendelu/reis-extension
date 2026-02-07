import React from 'react';
import ExamItem from './ExamItem';
import type { ExamTerm } from '../../../types/exams';
import { useTranslation } from '../../../hooks/useTranslation';

interface ExamTimelineProps {
  exams: { term: ExamTerm; subjectName: string; [key: string]: any }[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  onSelectItem?: (item: any) => void;
}

const ExamTimeline: React.FC<ExamTimelineProps> = ({ exams, orientation = 'vertical', className = '', onSelectItem }) => {
  const { t } = useTranslation();
  const parseDateTime = (d: string, tStr: string) => {
    // Robust parsing for "D. M. YYYY" or "D.M.YYYY"
    const parts = d.split('.').map(p => p.trim()).filter(p => p.length > 0);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const [hours, minutes] = tStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  };

  const filteredExams = [...exams]
    .sort((a, b) => 
      parseDateTime(a.term.date, a.term.time).getTime() - 
      parseDateTime(b.term.date, b.term.time).getTime()
    );

  const isHorizontal = orientation === 'horizontal';

  const timelineNodes = filteredExams.map(exam => ({
    ...exam,
    isVirtual: false,
    timestamp: parseDateTime(exam.term.date, exam.term.time).getTime()
  }));

  return (
    <div className={`${isHorizontal ? '' : 'p-8 max-w-2xl mx-auto bg-base-100 rounded-box shadow-sm border border-base-200'} ${className}`}>
      {!isHorizontal && (
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-2xl font-black tracking-tighter">{t('exams.title')}</h2>
          <div className="badge badge-primary badge-outline font-bold">S2 2026</div>
        </div>
      )}

      {isHorizontal ? (
        <div className={`flex flex-row overflow-x-auto gap-3 py-1.5 custom-scrollbar w-full h-fit ${className}`}>
          {timelineNodes.map((item, index) => (
            <ExamItem
              key={item.term.id || `${item.subjectName}-${index}`}
              term={item.term}
              subjectName={item.subjectName}
              orientation={orientation}
              onClick={() => onSelectItem?.(item)}
            />
          ))}
        </div>
      ) : (
        <ul className={`timeline timeline-snap-icon max-md:timeline-compact timeline-vertical ${className}`}>
          {timelineNodes.map((item, index) => (
            <ExamItem
              key={item.term.id || `${item.subjectName}-${index}`}
              term={item.term}
              subjectName={item.subjectName}
              orientation={orientation}
              isFirst={index === 0}
              isLast={index === timelineNodes.length - 1}
              onClick={() => onSelectItem?.(item)}
            />
          ))}
        </ul>
      )}
      
      {filteredExams.length === 0 && !isHorizontal && (
        <div className="text-center py-20 opacity-40">
          <div className="text-4xl mb-4">🎉</div>
          <p className="font-bold">{t('exams.noExams')}</p>
        </div>
      )}
    </div>
  );
};

export default ExamTimeline;
