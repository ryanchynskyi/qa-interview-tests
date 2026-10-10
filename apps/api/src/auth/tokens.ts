import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 30;
export const REFRESH_COOKIE = 'qa_rt';

const keyOf = (secret: string) => new TextEncoder().encode(secret);

export async function signAccessToken(
  userId: string,
  secret: string,
  now: number,
): Promise<string> {
  const iat = Math.floor(now / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL_SECONDS)
    .sign(keyOf(secret));
}

/** Returns the user id, or null for a missing/invalid/expired token. */
export async function verifyAccessToken(
  token: string,
  secret: string,
  now: number,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), {
      algorithms: ['HS256'],
      currentDate: new Date(now),
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** 256-bit opaque refresh token; only its SHA-256 is stored. */
export const newRefreshToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
