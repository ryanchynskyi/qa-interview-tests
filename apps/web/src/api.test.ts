import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, onSession, refreshSession, setAccessToken } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('session refresh', () => {
  it('signs out only when the server rejects the refresh token', async () => {
    const changes: unknown[] = [];
    onSession((s) => changes.push(s));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(401, { error: 'unauthorized' })),
    );
    await expect(refreshSession()).resolves.toBeNull();
    expect(changes).toEqual([null]);
  });

  it('keeps the session through a network failure', async () => {
    const changes: unknown[] = [];
    onSession((s) => changes.push(s));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(refreshSession()).rejects.toThrow('Failed to fetch');
    expect(changes).toEqual([]);
  });

  it('shares one refresh between concurrent callers (each refresh rotates the cookie)', async () => {
    const fetchMock = vi.fn(async () => json(200, { accessToken: 't2', user: { id: 'u' } }));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a request once with a fresh token after a 401', async () => {
    setAccessToken('expired');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'fresh', user: { id: 'u' } }))
      .mockResolvedValueOnce(json(200, { id: 'u' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.me()).resolves.toEqual({ id: 'u' });
    const lastHeaders = new Headers((fetchMock.mock.calls[2] as [string, RequestInit])[1].headers);
    expect(lastHeaders.get('authorization')).toBe('Bearer fresh');
  });
});
