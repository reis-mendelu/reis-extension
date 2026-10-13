/**
 * The two IdP pages the silent re-login can meet, told apart.
 *
 * Measured 2026-10-13: with a live IdP session alibaba answers the SSO
 * redirect with a SAMLResponse form that a browser auto-submits; with a dead
 * one it shows the password form. Nothing else appeared in between.
 */
export function findSamlPostForm(
  html: string,
  baseUrl: string
): { action: string; body: string } | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const form = doc.querySelector('input[name="SAMLResponse"]')?.closest('form');
  if (!form) return null;
  let action: string;
  try {
    action = new URL(form.getAttribute('action') ?? '', baseUrl).toString();
  } catch {
    return null;
  }
  const body = new URLSearchParams();
  for (const input of Array.from(form.querySelectorAll('input[name]'))) {
    if ((input.getAttribute('type') ?? 'text').toLowerCase() === 'submit') continue;
    body.append(input.getAttribute('name') ?? '', input.getAttribute('value') ?? '');
  }
  return { action, body: body.toString() };
}

export function hasPasswordForm(html: string): boolean {
  return /<input\b[^>]*\btype\s*=\s*["']?password/i.test(html);
}
