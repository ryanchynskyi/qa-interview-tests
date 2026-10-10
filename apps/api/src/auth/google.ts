/**
 * Google sign-in: OAuth 2.0 authorization-code flow with PKCE, done entirely on the
 * server. The ID token comes straight from Google's token endpoint over TLS, so per
 * OpenID Connect (3.1.3.7) its claims are checked without a signature check.
 */
import { createHash, randomBytes } from 'node:crypto';
import { decodeJwt } from 'jose';
import { HttpError } from '../lib/errors';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleIdentity {
  /** Stable Google account id. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleOAuth {
  authorizationUrl(state: string, codeChallenge: string): string;
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleIdentity>;
}

export const newPkceVerifier = () => randomBytes(32).toString('base64url');
export const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

/** Checks the ID token claims that matter for sign-in and extracts the identity. */
export function identityFromIdToken(
  idToken: string,
  clientId: string,
  now: number,
): GoogleIdentity {
  let c: ReturnType<typeof decodeJwt>;
  try {
    c = decodeJwt(idToken);
  } catch {
    throw new HttpError(401, 'google_invalid_token', 'Malformed ID token');
  }
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!ISSUERS.has(String(c.iss))) throw new HttpError(401, 'google_invalid_token', 'Wrong issuer');
  if (!aud.includes(clientId)) throw new HttpError(401, 'google_invalid_token', 'Wrong audience');
  if (typeof c.exp !== 'number' || c.exp * 1000 <= now) {
    throw new HttpError(401, 'google_invalid_token', 'ID token expired');
  }
  if (typeof c.sub !== 'string' || typeof c.email !== 'string') {
    throw new HttpError(401, 'google_invalid_token', 'ID token lacks sub/email');
  }
  return {
    sub: c.sub,
    email: c.email.trim().toLowerCase(),
    emailVerified: c.email_verified === true || c.email_verified === 'true',
    name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 60) : null,
  };
}

export function createGoogleOAuth(
  cfg: GoogleConfig,
  now: () => number = Date.now,
  fetchImpl: typeof fetch = fetch,
): GoogleOAuth {
  return {
    authorizationUrl(state, codeChallenge) {
      const u = new URL(AUTH_URL);
      u.search = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString();
      return u.toString();
    },

    async exchangeCode(code, codeVerifier) {
      const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          code_verifier: codeVerifier,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!res.ok)
        throw new HttpError(401, 'google_exchange_failed', `Token exchange: HTTP ${res.status}`);
      const body = (await res.json()) as { id_token?: string };
      if (!body.id_token)
        throw new HttpError(401, 'google_exchange_failed', 'No id_token returned');
      return identityFromIdToken(body.id_token, cfg.clientId, now());
    },
  };
}
