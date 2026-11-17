import { SCHOOL_PROFILES, isSchoolId } from '../src/utils/schoolProfiles';
import { storeZipProblems } from './isHostSwap';

// `npm run zip:vse` runs this before it builds: a store zip is made only for a
// school whose listing is complete (scripts/isHostSwap.ts, storeZipProblems).
//
//   tsx scripts/assertStoreReady.ts vse

const id = process.argv[2] ?? '';
if (!isSchoolId(id)) {
  console.error(`assertStoreReady: "${id}" is not a school in src/utils/schoolProfiles.ts`);
  process.exit(1);
}
const problems = storeZipProblems(SCHOOL_PROFILES[id]);
for (const p of problems) console.error(`Not ready for the store: ${p}`);
if (problems.length) process.exit(1);
console.log(`${SCHOOL_PROFILES[id].listing?.name}: ready for a store zip.`);
