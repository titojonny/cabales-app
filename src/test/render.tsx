import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

/** Renderiza con Query sin reintentos y un router en memoria. */
export function renderPage(ui: ReactElement, route = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Respuesta con el sobre `{ success, data }` de la API. */
export function apiResponse(data: unknown, status = 200, meta?: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Stub de fetch que responde según el path (sin query) y registra las llamadas. */
export function routeFetch(routes: Record<string, () => Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
      .replace(/^https?:\/\/[^/]+/, '')
      .split('?')[0]!;
    const handler = routes[path];
    if (!handler) throw new Error(`Ruta no simulada: ${path}`);
    return handler();
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
