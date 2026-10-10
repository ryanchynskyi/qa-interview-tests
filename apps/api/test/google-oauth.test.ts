import { describe, expect, it, vi } from 'vitest';
import { createGoogleOAuth, identityFromIdToken, pkceChallenge } from '../src/auth/google';

const CLIENT = 'client-123.apps.googleusercontent.com';
const now = Date.parse('2026-10-10T08:00:00Z');
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** An ID token as Google's token endpoint returns it (signature irrelevant here). */
export const idToken = (claims: Record<string, unknown>) =>
  `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: 'https://accounts.google.com',
    aud: CLIENT,
    exp: Math.floor(now / 1000) + 3600,
    sub: '1234567890',
    email: 'Person@Gmail.com',
    email_verified: true,
    name: 'Test Person',
    ...claims,
  })}.signature`;

describe('identityFromIdToken', () => {
  it('extracts a normalised identity', () => {
    expect(identityFromIdToken(idToken({}), CLIENT, now)).toEqual({
      sub: '1234567890',
      email: 'person@gmail.com',
      emailVerified: true,
      name: 'Test Person',
    });
  });

  it.each([
    ['wrong issuer', { iss: 'https://evil.example' }],
    ['wrong audience', { aud: 'someone-else' }],
    ['expired', { exp: Math.floor(now / 1000) - 1 }],
    ['no email', { email: undefined }],
  ])('rejects a token with %s', (_name, claims) => {
    expect(() => identityFromIdToken(idToken(claims), CLIENT, now)).toThrow();
  });

  it('rejects garbage', () => {
    expect(() => identityFromIdToken('not-a-jwt', CLIENT, now)).toThrow();
  });
});

describe('createGoogleOAuth', () => {
  const cfg = {
    clientId: CLIENT,
    clientSecret: 'secret',
    redirectUri: 'http://localhost:5173/api/auth/google/callback',
  };

  it('builds an authorization URL with PKCE S256 and the requested scopes', () => {
    const url = new URL(
      createGoogleOAuth(cfg, () => now).authorizationUrl('st', pkceChallenge('verifier')),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'st',
      code_challenge: pkceChallenge('verifier'),
      code_challenge_method: 'S256',
    });
  });

  it('exchanges the code with the verifier and secret, then reads the ID token', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id_token: idToken({}) })));
    const g = createGoogleOAuth(cfg, () => now, fetchImpl as unknown as typeof fetch);
    await expect(g.exchangeCode('the-code', 'the-verifier')).resolves.toMatchObject({
      sub: '1234567890',
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const body = Object.fromEntries(init.body as URLSearchParams);
    expect(body).toMatchObject({
      code: 'the-code',
      code_verifier: 'the-verifier',
      client_secret: 'secret',
      grant_type: 'authorization_code',
      redirect_uri: cfg.redirectUri,
    });
  });

  it('fails cleanly when Google rejects the code', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 400 }));
    const g = createGoogleOAuth(cfg, () => now, fetchImpl as unknown as typeof fetch);
    await expect(g.exchangeCode('bad', 'v')).rejects.toMatchObject({
      code: 'google_exchange_failed',
    });
  });
});
