import { esnDataset } from './data/esn';
import { ldfDataset } from './data/ldf';
import { supefDataset } from './data/supef';
import type { SocietyDataset } from './MockManager';

export const MOCK_REGISTRY: Record<string, SocietyDataset> = {
  esn: esnDataset,
  ldf: ldfDataset,
  supef: supefDataset,
  // Add more as needed
};

export const DEFAULT_MOCK_SOCIETY = 'esn';
