import { useEffect } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectRow } from './SubjectRow';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ChevronDown } from 'lucide-react';

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string) => void;
  onSearchSubject: (name: string) => void;
}

export function SubjectsPanel({ onOpenSubject, onSearchSubject }: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const loading = useAppStore(s => s.studyPlanLoading);

  useEffect(() => {
    useAppStore.getState().fetchStudyPlan();
  }, []);

  if (loading && !plan) {
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.loading')}</div>;
  }

  if (!plan) {
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.noData')}</div>;
  }

  const enrolled = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.filter(s => s.isEnrolled)));

  return (
    <div className="h-full overflow-y-auto">
      <SubjectsPanelHeader creditsAcquired={plan.creditsAcquired} creditsRequired={plan.creditsRequired} />

      {enrolled.length > 0 && (
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-base-content/70 mb-2">{t('subjects.enrolled')}</h3>
          <div className="flex flex-col gap-0.5">
            {enrolled.map(s => (
              <SubjectRow key={s.code} subject={s} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="study-plan">
            <AccordionTrigger className="text-sm font-semibold text-base-content/70">
              {t('subjects.studyPlan')}
              <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" />
            </AccordionTrigger>
            <AccordionContent>
              <Accordion type="multiple">
                {plan.blocks.map((block, bi) => (
                  <AccordionItem key={bi} value={`block-${bi}`}>
                    <AccordionTrigger className="text-sm font-medium">
                      {block.title}
                      <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" />
                    </AccordionTrigger>
                    <AccordionContent>
                      {block.groups.map((group, gi) => (
                        <div key={gi} className="mb-3">
                          <div className="text-xs text-base-content/50 font-medium mb-1 px-3">{group.name}</div>
                          {group.subjects.map(s => (
                            <SubjectRow key={s.code} subject={s} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />
                          ))}
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
