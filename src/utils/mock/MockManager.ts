import { IndexedDBService } from '../../services/storage';
import { StoreSchemas, type StoreName } from '../../types/storage';
import type { SyllabusRequirements, SubjectSuccessRate } from '../../types/documents';
import type { ExamSubject } from '../../types/exams';
import type { BlockLesson } from '../../types/calendarTypes';

export interface SocietyDataset {
  id: string;
  name: string;
  exams: ExamSubject[];
  schedule: BlockLesson[];
  syllabuses?: Record<string, SyllabusRequirements>;
  success_rates?: Record<string, SubjectSuccessRate>;
}

class MockManagerImpl {
  private activeDataset: SocietyDataset | null = null;

  /**
   * Validates and sets a dataset as the active mock data source.
   */
  async loadDataset(dataset: SocietyDataset): Promise<void> {
    console.log(`[MockManager] Validating and loading dataset: ${dataset.name} (${dataset.id})`);

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
  }

  private validate(data: any, storeName: StoreName) {
    const schema = StoreSchemas[storeName];
    if (!schema) return;

    const result = schema.safeParse(data);
    if (!result.success) {
      console.error(`[MockManager] Validation FAILED for ${storeName} in dataset ${this.activeDataset?.id}:`, result.error);
      throw new Error(`Data corruption detected in mock dataset: ${storeName}`);
    }
  }

  getActiveSocietyId(): string | null {
    return this.activeDataset?.id || null;
  }
}

export const MockManager = new MockManagerImpl();
