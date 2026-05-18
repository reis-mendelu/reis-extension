export type SortMode = 'default' | 'failRateDesc' | 'failRateAsc' | 'creditsDesc' | 'alpha';

export interface SubjectFilters {
  hideFulfilled: boolean;
  semesterType: 'all' | 'ZS' | 'LS';
}

export const DEFAULT_FILTERS: SubjectFilters = { hideFulfilled: false, semesterType: 'all' };
