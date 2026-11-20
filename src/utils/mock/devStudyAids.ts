import type { AdminStudyAids } from '../../api/adminStudyAids';

// Dev-only study-aids store for `npm run dev:web` (VITE_DEV_SOCIETY): the fake
// admin session cannot pass RLS, so the console's writes land here and never
// reach Supabase. Seeded like the migration seeds the real table. Only reached
// behind DEV_SOCIETY, which is gated on import.meta.env.DEV, so `wxt build`
// strips it. Type-only import keeps this a leaf, as devQuestions.ts is.

let rows: AdminStudyAids[] = [
  { id: 'mendelu-app', audience: ['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'], isActive: false },
];

export const devStudyAidsStore = {
  list(): AdminStudyAids[] {
    return rows.map((r) => ({ ...r }));
  },
  save(id: string, patch: Pick<AdminStudyAids, 'audience' | 'isActive'>): boolean {
    rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    return true;
  },
};
