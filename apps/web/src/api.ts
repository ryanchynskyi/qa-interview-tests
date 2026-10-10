import type {
  AccountInfo,
  ApiError,
  AuthResponse,
  AuthUser,
  Catalog,
  ChapterDto,
  CheckAnswerRequest,
  CheckAnswerWithProgress,
  ImportPayload,
  ImportResult,
  LoginRequest,
  PlayerProgress,
  ProgressUpdate,
  QuizQuestion,
  RecallCardDto,
  RegisterRequest,
  SearchHit,
  XpDay,
} from '@qa-hub/shared';
import { getLang, type Lang } from './i18n';

/** Same-origin `/api` in dev (Vite proxy); set VITE_API_URL for a separately hosted API. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.message ?? `HTTP ${status}`);
  }
  get code() {
    return this.body?.error;
  }
}

/** Full-page navigation target that starts Google sign-in (the API redirects to Google). */
export function googleSignInUrl(next: string): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return `${BASE}/auth/google?next=${encodeURIComponent(next)}&tz=${encodeURIComponent(tz)}`;
}

/* ---------- session token (memory only; the refresh token is an httpOnly cookie) ---------- */

let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionChange: (session: AuthResponse | null) => void = () => {};

export const setAccessToken = (token: string | null) => void (accessToken = token);
export const onSession = (fn: (session: AuthResponse | null) => void) =>
  void (onSessionChange = fn);

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const res = await fetch(BASE + path, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new HttpError(res.status, body);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/**
 * Exchanges the refresh cookie for a new access token. Single-flight: concurrent
 * callers share one request, since each refresh rotates the cookie.
 * Resolves null only when the server says the session is over (401); a network
 * failure or a restarting API rejects instead, so a blip never signs anyone out.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const session = await raw<AuthResponse>('/auth/refresh', { method: 'POST' });
      accessToken = session.accessToken;
      onSessionChange(session);
      return session;
    } catch (e) {
      if (!(e instanceof HttpError) || e.status !== 401) throw e;
      accessToken = null;
      onSessionChange(null);
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

const googleExchanges = new Map<string, Promise<AuthResponse>>();

/**
 * Trades the Google callback's one-time code for a session. The code is single-use, so
 * repeated calls (React StrictMode runs effects twice in dev) share the first request:
 * a second redemption would get a 401 and could sign out the session the first one made.
 */
function googleExchange(code: string): Promise<AuthResponse> {
  let p = googleExchanges.get(code);
  if (!p) {
    p = raw<AuthResponse>('/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    googleExchanges.set(code, p);
  }
  return p;
}

/** Like raw(), but an expired access token is refreshed once and the call retried. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 401 || !accessToken) throw e;
    if (!(await refreshSession())) throw e;
    return raw<T>(path, init);
  }
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

/** Ukrainian (the source) needs no parameter; other languages ask for their overlay. */
const withLang = (path: string, lang: Lang) =>
  lang === 'uk' ? path : `${path}${path.includes('?') ? '&' : '?'}lang=${lang}`;

export const api = {
  /* content */
  catalog: (lang: Lang = 'uk') => request<Catalog>(withLang('/content/catalog', lang)),
  questions: (sectionId: string, lang: Lang = 'uk') =>
    request<QuizQuestion[]>(withLang(`/sections/${encodeURIComponent(sectionId)}/questions`, lang)),
  recallCards: (lang: Lang = 'uk') => request<RecallCardDto[]>(withLang('/recall/cards', lang)),
  chapter: (id: string, lang: Lang = 'uk') =>
    request<ChapterDto>(withLang(`/kb/chapters/${encodeURIComponent(id)}`, lang)),
  search: (q: string, lang: Lang = 'uk') =>
    request<SearchHit[]>(withLang(`/kb/search?q=${encodeURIComponent(q)}`, lang)),

  /* answers: also recorded server-side when signed in; the explanation is in the UI language */
  checkAnswer: (body: CheckAnswerRequest) =>
    post<CheckAnswerWithProgress>('/quiz/check', { ...body, lang: body.lang ?? getLang() }),

  /* auth */
  register: (body: RegisterRequest) =>
    raw<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginRequest) =>
    raw<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => raw<void>('/auth/logout', { method: 'POST' }),
  googleExchange,
  me: () => request<AuthUser>('/auth/me'),
  providers: () => request<{ google: boolean }>('/auth/providers'),

  /* profile */
  account: () => request<AccountInfo>('/me/account'),
  updateMe: (body: { displayName?: string; timeZone?: string }) =>
    request<AuthUser>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword?: string; newPassword: string }) =>
    post<void>('/me/password', body),
  xpHistory: (days = 30) => request<XpDay[]>(`/me/xp-history?days=${days}`),
  deleteAccount: (confirmEmail: string) =>
    request<void>('/me', { method: 'DELETE', body: JSON.stringify({ confirmEmail }) }),

  /* signed-in progress */
  progress: () => request<PlayerProgress>('/me/progress'),
  finishQuiz: (sectionId: string, questionIds: string[]) =>
    post<ProgressUpdate>('/me/quiz/finish', { sectionId, questionIds }),
  rateCard: (cardId: string, rating: number) =>
    post<ProgressUpdate>('/me/recall/rate', { cardId, rating }),
  readArticle: (articleId: string) =>
    post<ProgressUpdate>(`/me/articles/${encodeURIComponent(articleId)}/read`),
  importProgress: (payload: ImportPayload) => post<ImportResult>('/me/import', payload),
  resetSection: (sectionId: string) =>
    post<void>(`/me/sections/${encodeURIComponent(sectionId)}/reset`),
};
