import type {
  ApiError,
  Catalog,
  ChapterDto,
  CheckAnswerRequest,
  CheckAnswerResponse,
  QuizQuestion,
  RecallCardDto,
  SearchHit,
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
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new HttpError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export const api = {
  catalog: () => request<Catalog>('/content/catalog'),
  questions: (sectionId: string) =>
    request<QuizQuestion[]>(`/sections/${encodeURIComponent(sectionId)}/questions`),
  checkAnswer: (body: CheckAnswerRequest) =>
    request<CheckAnswerResponse>('/quiz/check', { method: 'POST', body: JSON.stringify(body) }),
  recallCards: () => request<RecallCardDto[]>('/recall/cards'),
  chapter: (id: string) => request<ChapterDto>(`/kb/chapters/${encodeURIComponent(id)}`),
  search: (q: string) => request<SearchHit[]>(`/kb/search?q=${encodeURIComponent(q)}`),
};
