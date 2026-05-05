import React, { useState } from 'react';
import ExamItem from './ExamItem';
import { TimelineDrawer } from './TimelineDrawer';
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
  onUnregister?: (section: ExamSection) => void;
  onChangeTerm?: (section: ExamSection, termId: string) => void;
  processingSectionId?: string | null;
}

const ExamTimeline: React.FC<ExamTimelineProps> = ({
  exams, orientation = 'vertical', className = '',
  onSelectItem, onUnregister, onChangeTerm, processingSectionId
}) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const parseDateTime = (d: string, tStr: string) => {
    const parts = d.split('.').map(p => p.trim()).filter(p => p.length > 0);
    return new Date(+parts[2], +parts[1] - 1, +parts[0], ...tStr.split(':').map(Number) as [number, number]);
  };

  const sortedExams = [...exams].sort((a, b) =>
    parseDateTime(a.term.date, a.term.time).getTime() - parseDateTime(b.term.date, b.term.time).getTime()
  );

  const isHorizontal = orientation === 'horizontal';
  const selectedExam = selectedId ? sortedExams.find(e => e.term.id === selectedId) ?? null : null;

  const handleCardClick = (exam: TimelineExam) => {
    const id = exam.term.id;
    setSelectedId(p => p === id ? null : id);
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
            deadline={item.section?.registeredTerm?.deregistrationDeadline}
            orientation="horizontal"
            isSelected={selectedId === item.term.id}
            onClick={() => handleCardClick(item)}
          />
        ))}
      </div>

      {selectedExam?.section && (
        <TimelineDrawer
          exam={selectedExam}
          onUnregister={onUnregister}
          onChangeTerm={onChangeTerm}
          isProcessing={processingSectionId === selectedExam.section.id}
        />
      )}
    </>
  );
};

export default ExamTimeline;
