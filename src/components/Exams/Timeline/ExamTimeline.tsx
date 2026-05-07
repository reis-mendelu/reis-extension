import React from 'react';
import ExamItem from './ExamItem';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ExamSection } from '../../../types/exams';

export interface TimelineExam {
  term: { id: string; date: string; time: string; [key: string]: unknown };
  subjectName: string;
  section?: ExamSection;
  [key: string]: unknown;
}

interface ExamTimelineProps {
  exams: TimelineExam[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  onSelectItem?: (item: TimelineExam) => void;
  selectedSectionId?: string | null;
}

const ExamTimeline: React.FC<ExamTimelineProps> = ({
  exams, orientation = 'vertical', className = '',
  onSelectItem, selectedSectionId
}) => {
  const { t, language } = useTranslation();

  const resolveSectionName = (item: TimelineExam): string | undefined => {
    const s = item.section;
    if (!s) return undefined;
    return (language === 'en' ? s.nameEn : s.nameCs) || s.name || undefined;
  };
  const parseDateTime = (d: string, tStr: string) => {
    const parts = d.split('.').map(p => p.trim()).filter(p => p.length > 0);
    return new Date(+parts[2], +parts[1] - 1, +parts[0], ...tStr.split(':').map(Number) as [number, number]);
  };

  const sortedExams = [...exams].sort((a, b) =>
    parseDateTime(a.term.date, a.term.time).getTime() - parseDateTime(b.term.date, b.term.time).getTime()
  );

  const isHorizontal = orientation === 'horizontal';

  const handleCardClick = (exam: TimelineExam) => {
    onSelectItem?.(exam);
  };

  if (!isHorizontal) {
    return (
      <div className={`p-8 max-w-2xl mx-auto bg-base-100 rounded-box shadow-sm border border-base-200 ${className}`}>
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-2xl font-black tracking-tighter">{t('exams.title')}</h2>
          <div className="badge badge-primary badge-outline font-bold">S2 2026</div>
        </div>
        <ul className={`timeline timeline-snap-icon max-md:timeline-compact timeline-vertical ${className}`}>
          {sortedExams.map((item, index) => (
            <ExamItem
              key={item.term.id || `${item.subjectName}-${index}`}
              term={item.term}
              subjectName={item.subjectName}
              sectionName={resolveSectionName(item)}
              deadline={item.section?.registeredTerm?.deregistrationDeadline}
              orientation={orientation}
              isFirst={index === 0}
              isLast={index === sortedExams.length - 1}
              onClick={() => handleCardClick(item)}
            />
          ))}
        </ul>
        {sortedExams.length === 0 && (
          <div className="text-center py-20 opacity-40">
            <div className="text-4xl mb-4">🎉</div>
            <p className="font-bold">{t('exams.noExams')}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`flex flex-row overflow-x-auto gap-3 py-1.5 px-0.5 w-full h-fit ${className}`}>
        {sortedExams.map((item, index) => (
          <ExamItem
            key={item.term.id || `${item.subjectName}-${index}`}
            term={item.term}
            subjectName={item.subjectName}
            sectionName={resolveSectionName(item)}
            deadline={item.section?.registeredTerm?.deregistrationDeadline}
            orientation="horizontal"
            isSelected={selectedSectionId === item.section?.id}
            onClick={() => handleCardClick(item)}
          />
        ))}
      </div>

    </>
  );
};

export default ExamTimeline;
