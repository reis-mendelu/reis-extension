// For release-checklist.yml: prints the PR body with the privacy block placed or
// refreshed. Env: PR_BODY, BASE_TAG (last v* tag, may be empty), HEAD_REF.
import { buildBlock } from './checklist-cli';
import { placeBlock } from './checklist';

const block = await buildBlock(process.env.BASE_TAG ?? '', process.env.HEAD_REF ?? 'HEAD');
process.stdout.write(placeBlock(process.env.PR_BODY ?? '', block));
