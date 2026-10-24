import { describe, it, expect } from 'vitest';
import { findSamlPostForm, hasPasswordForm } from '../samlForm';

const SAML = `<html><body onload="document.forms[0].submit()"><noscript><p>Continue</p></noscript>
<form action="https&#x3a;&#x2f;&#x2f;webiskam.mendelu.cz&#x2f;Shibboleth.sso&#x2f;SAML2&#x2f;POST" method="post">
<input type="hidden" name="RelayState" value="ss&#x3a;mem&#x3a;abc"/>
<input type="hidden" name="SAMLResponse" value="PHNhbWw+"/>
<input type="submit" value="Continue"/></form></body></html>`;

describe('samlForm', () => {
  it('decodes the entity-encoded action and posts the hidden fields', () => {
    const f = findSamlPostForm(SAML, 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO');
    expect(f?.action).toBe('https://webiskam.mendelu.cz/Shibboleth.sso/SAML2/POST');
    expect(new URLSearchParams(f!.body).get('SAMLResponse')).toBe('PHNhbWw+');
    expect(new URLSearchParams(f!.body).get('RelayState')).toBe('ss:mem:abc');
  });

  it('finds no SAML form on the password page, and sees the password field', () => {
    const login =
      '<form action="/idp/x" method="post"><input name="j_username"><input type="password" name="j_password"></form>';
    expect(findSamlPostForm(login, 'https://alibaba.mendelu.cz/idp/x')).toBeNull();
    expect(hasPasswordForm(login)).toBe(true);
    expect(hasPasswordForm(SAML)).toBe(false);
  });
});
