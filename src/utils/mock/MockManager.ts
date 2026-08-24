import { IndexedDBService } from '../../services/storage';
import { StoreSchemas, type StoreName } from '../../types/storage';
import type { SyllabusRequirements, SubjectSuccessRate } from '../../types/documents';
import type { ExamSubject } from '../../types/exams';
import type { BlockLesson } from '../../types/calendarTypes';
import type { DualLanguageStudyPlan, StudyStats, StudyComparison } from '../../types/studyPlan';

export interface SocietyDataset {
  id: string;
  name: string;
  exams: ExamSubject[];
  schedule: BlockLesson[];
  syllabuses?: Record<string, SyllabusRequirements>;
  success_rates?: Record<string, SubjectSuccessRate>;

  /**
   * Optional so the three society datasets stay valid. Only the `demo`
   * dataset fills them — they exist to make the subjects tab render for a
   * reviewer who has no account.
   */
  studyPlan?: DualLanguageStudyPlan;
  studyStats?: StudyStats;
  studyComparison?: StudyComparison;
}

class MockManagerImpl {
  private activeDataset: SocietyDataset | null = null;

  /**
   * Validates and sets a dataset as the active mock data source.
   */
  async loadDataset(dataset: SocietyDataset): Promise<void> {
    this.validate(dataset.exams, 'exams');
    this.validate(dataset.schedule, 'schedule');
    if (dataset.syllabuses) {
      for (const syllabus of Object.values(dataset.syllabuses)) {
        this.validate(syllabus, 'syllabuses');
      }
    }

    this.activeDataset = dataset;

    // Apply to IndexedDB
    await IndexedDBService.clear('exams');
    await IndexedDBService.set('exams', 'current', dataset.exams);

    await IndexedDBService.clear('schedule');
    await IndexedDBService.set('schedule', 'current', dataset.schedule);

    if (dataset.syllabuses) {
      await IndexedDBService.clear('syllabuses');
      for (const [code, syllabus] of Object.entries(dataset.syllabuses)) {
        await IndexedDBService.set('syllabuses', code, syllabus);
      }
    }

    if (dataset.success_rates) {
      await IndexedDBService.clear('success_rates');
      for (const [code, rate] of Object.entries(dataset.success_rates)) {
        await IndexedDBService.set('success_rates', code, rate);
      }
    }

    if (dataset.studyPlan) {
      await IndexedDBService.set('study_plan', 'current', dataset.studyPlan);
    }

    // study_stats and study_comparison are KEYS IN `meta`, not stores of
    // their own — see createStudyPlanSlice. Never clear `meta` to seed them:
    // the theme, the language and the crash-report opt-out live there too.
    if (dataset.studyStats) {
      await IndexedDBService.set('meta', 'study_stats', dataset.studyStats);
    }
    if (dataset.studyComparison) {
      await IndexedDBService.set('meta', 'study_comparison', dataset.studyComparison);
    }
  }

  private validate(data: unknown, storeName: StoreName) {
    const schema = StoreSchemas[storeName];
    if (!schema) return;

    const result = schema.safeParse(data);
    if (!result.success) {
      console.error(
        `[MockManager] Validation FAILED for ${storeName} in dataset ${this.activeDataset?.id}:`,
        result.error
      );
      throw new Error(`Data corruption detected in mock dataset: ${storeName}`);
    }
  }

  getActiveSocietyId(): string | null {
    return this.activeDataset?.id || null;
  }
}

export const MockManager = new MockManagerImpl();
