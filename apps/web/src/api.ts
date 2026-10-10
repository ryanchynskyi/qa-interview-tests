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

export const api = {
  /* content */
  catalog: () => request<Catalog>('/content/catalog'),
  questions: (sectionId: string) =>
    request<QuizQuestion[]>(`/sections/${encodeURIComponent(sectionId)}/questions`),
  recallCards: () => request<RecallCardDto[]>('/recall/cards'),
  chapter: (id: string) => request<ChapterDto>(`/kb/chapters/${encodeURIComponent(id)}`),
  search: (q: string) => request<SearchHit[]>(`/kb/search?q=${encodeURIComponent(q)}`),

  /* answers: also recorded server-side when signed in */
  checkAnswer: (body: CheckAnswerRequest) => post<CheckAnswerWithProgress>('/quiz/check', body),

  /* auth */
  register: (body: RegisterRequest) =>
    raw<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginRequest) =>
    raw<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => raw<void>('/auth/logout', { method: 'POST' }),
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
