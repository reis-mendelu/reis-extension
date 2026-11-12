// Republishes the privacy-policy gist from docs/privacy-policy-app.md and reads
// it back. Runs inside .github/workflows/privacy-gist.yml, so a release can do
// it without anyone's local gh login (the cloud session cannot switch to
// ElijaahInverted, who owns the gist).
//
// Token: GIST_TOKEN, a fine-grained personal access token of ElijaahInverted
// with only the account permission "Gists: Read and write". GITHUB_TOKEN cannot
// do this: an App installation token is not accepted for gists (gate.ts).
import { readFileSync } from 'node:fs';
import { GIST_ID, sameContent } from './gate';

const API = `https://api.github.com/gists/${GIST_ID}`;

export async function pushGist(i: {
  token: string;
  policy: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (!i.token) throw new Error('GIST_TOKEN is not set');
  const f = i.fetchImpl ?? fetch;
  const headers = {
    Authorization: `Bearer ${i.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const res = await f(API, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ files: { 'privacy.md': { content: i.policy } } }),
  });
  if (!res.ok) throw new Error(`gist write failed: HTTP ${res.status} ${await res.text()}`);

  // Read back through the API with the same token: authenticated, so no shared
  // runner rate limit, and no CDN between the write and the read.
  const back = await f(API, { headers });
  if (!back.ok) throw new Error(`gist read-back failed: HTTP ${back.status}`);
  const live = ((await back.json()) as { files?: Record<string, { content?: string }> }).files?.[
    'privacy.md'
  ]?.content;
  if (live === undefined || !sameContent(live, i.policy)) {
    throw new Error('gist read-back differs from docs/privacy-policy-app.md');
  }
}

if (process.argv[1]?.endsWith('gist-push.ts')) {
  await pushGist({
    token: process.env.GIST_TOKEN ?? '',
    policy: readFileSync('docs/privacy-policy-app.md', 'utf-8'),
  });
  console.log(`gist ${GIST_ID}: published and read back — matches docs/privacy-policy-app.md`);
}
