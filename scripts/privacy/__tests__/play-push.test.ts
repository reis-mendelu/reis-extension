import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { serviceAccountJwt } from '../play-push';

describe('serviceAccountJwt', () => {
  it('is a verifiable RS256 JWT for the androidpublisher scope', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const jwt = serviceAccountJwt('sa@x.iam.gserviceaccount.com', pem, 1000);
    const [h, c, s] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(c!, 'base64url').toString());
    expect(claims).toMatchObject({
      iss: 'sa@x.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1000,
      exp: 1600,
    });
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(s!, 'base64url'))).toBe(true);
  });
});
