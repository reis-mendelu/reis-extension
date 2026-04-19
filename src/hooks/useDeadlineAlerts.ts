import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { parseDate } from '../utils/date';

export interface DeadlineAlert {
  id: string;
  type: 'exam-reg-opens' | 'exam-reg' | 'assignment';
  title: string;
  body: string;
  deadline: Date;
  hoursUntil: number;
  link?: string;
}

function parseCzDateTime(s: string): Date | null {
  if (!s) return null;
  const [datePart, timePart] = s.split(' ');
  try {
    return parseDate(datePart, timePart ?? '00:00');
  } catch {
    return null;
  }
}

const H = 3_600_000;

export function useDeadlineAlerts() {
  const exams = useAppStore(s => s.exams.data);
  const odevzdavarny = useAppStore(s => s.odevzdavarny);
  const language = useAppStore(s => s.language);
  const seenIds = useAppStore(s => s.notifications.seenDeadlineAlertIds);
  const markDeadlineAlertsSeen = useAppStore(s => s.markDeadlineAlertsSeen);
  const pulseNow = useAppStore(s => s.now);

  const markAllSeen = useCallback((ids: string[]) => {
    markDeadlineAlertsSeen(ids);
  }, [markDeadlineAlertsSeen]);

  const alerts = useMemo(() => {
    const now = pulseNow.getTime();
    const isEn = language === 'en';
    const result: DeadlineAlert[] = [];

    for (const subject of exams) {
      const subjectName = (isEn ? subject.nameEn : subject.nameCs) ?? subject.name;

      for (const section of subject.sections) {
        const sectionName = (isEn ? section.nameEn : section.nameCs) ?? section.name;

        if (section.status === 'available') {
          for (const term of section.terms) {
            if (term.registrationStart) {
              const start = parseCzDateTime(term.registrationStart);
              if (start) {
                const h = (start.getTime() - now) / H;
                if (h > 0 && h <= 24)
                  result.push({ id: `exam-opens-${term.id}`, type: 'exam-reg-opens', title: subjectName, body: sectionName, deadline: start, hoursUntil: h });
              }
            }
            if (term.registrationEnd) {
              const end = parseCzDateTime(term.registrationEnd);
              if (end) {
                const h = (end.getTime() - now) / H;
                const startTime = term.registrationStart ? parseCzDateTime(term.registrationStart)?.getTime() : undefined;
                const isOpen = !startTime || startTime <= now;
                if (h > 0 && h <= 48 && isOpen)
                  result.push({ id: `exam-reg-${term.id}`, type: 'exam-reg', title: subjectName, body: sectionName, deadline: end, hoursUntil: h });
              }
            }
          }
        }
      }
    }

    for (const a of odevzdavarny) {
      if (a.fileCount > 0 || !a.deadline) continue;
      const deadline = parseCzDateTime(a.deadline);
      if (!deadline) continue;
      const h = (deadline.getTime() - now) / H;
      if (h > 0 && h <= 48) {
        const courseName = isEn ? a.courseNameEn : a.courseNameCs;
        result.push({ id: `odev-${a.odevzdavarnaId || a.name}`, type: 'assignment', title: courseName, body: a.name, deadline, hoursUntil: h, link: a.uploadUrl });
      }
    }

    result.sort((a, b) => a.hoursUntil - b.hoursUntil);
    return result;
  }, [exams, odevzdavarny, language, pulseNow]);

  const unseenCount = useMemo(() => 
    alerts.filter(a => !seenIds.has(a.id)).length,
    [alerts, seenIds]
  );

  return { alerts, markAllSeen, unseenCount };
}
