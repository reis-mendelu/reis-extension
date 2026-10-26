// npm run privacy:generate — rewrites the policy table from privacy/disclosures.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { FLOWS } from '../../privacy/disclosures';
import { renderPolicyTable, replaceGenerated } from './policyTable';

const path = 'docs/privacy-policy-app.md';
const before = readFileSync(path, 'utf-8');
const after = replaceGenerated(before, renderPolicyTable(FLOWS));
writeFileSync(path, after);
console.log(before === after ? `${path}: already up to date` : `${path}: table regenerated`);
