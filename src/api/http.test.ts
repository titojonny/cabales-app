import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken, request } from './http';

function envelopeResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'server-request' },
  });
}

afterEach(() => {
  clearCsrfToken();
  document.cookie = 'cabales_session_csrf=; Max-Age=0; path=/';
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('usa cookies y propaga CSRF e idempotencia en mutaciones', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelopeResponse({ csrfToken: 'csrf-token-with-valid-length' }))
      .mockResolvedValueOnce(envelopeResponse({ id: 'expense-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await request('/auth/login', { method: 'POST', body: { email: 'a@b.co' } });
    await request('/expenses', { method: 'POST', body: {}, idempotencyKey: 'attempt-1' });

    const options = fetchMock.mock.calls[1][1] as RequestInit;
    const headers = options.headers as Headers;
    expect(options.credentials).toBe('include');
    expect(headers.get('X-CSRF-Token')).toBe('csrf-token-with-valid-length');
    expect(headers.get('Idempotency-Key')).toBe('attempt-1');
  });

  it('recupera el CSRF de la cookie legible después de perder el estado en memoria', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse({ saved: true }));
    vi.stubGlobal('fetch', fetchMock);
    clearCsrfToken();
    document.cookie = 'cabales_session_csrf=csrf-from-readable-cookie-123; path=/';

    await request('/groups', { method: 'POST', body: { name: 'Viaje' } });

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('csrf-from-readable-cookie-123');
  });
});
