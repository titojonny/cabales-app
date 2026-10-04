import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import responses from '../test/fixtures/api-responses.json';
import { AuthProvider } from '../auth/AuthProvider';
import { apiError, apiResponse, routeFetch } from '../test/render';
import { CreateExpensePage } from './ExpensePages';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('editor de items del gasto', () => {
  it('envía asignaciones EXACT calculadas por persona desde un borrador OCR', async () => {
    const jobId = 'f4b7f9ac-9c19-44c0-bf6c-0f8a1a9f6e01';
    const job = {
      id: jobId,
      documentId: '8b7f7a5e-7f25-4e8b-9c2d-1cb7f8e8d001',
      status: 'SUCCEEDED',
      attempts: 1,
      errorCode: null,
      createdAt: '2026-10-03T10:00:00.000Z',
      finishedAt: '2026-10-03T10:00:02.000Z',
      confirmedAt: null,
      confirmedExpenseId: null,
      proposal: {
        merchant: 'Mercado Central',
        totalCents: 100,
        subtotalCents: null,
        taxCents: null,
        tipCents: null,
        currency: 'USD',
        occurredAt: '2026-10-02T00:00:00.000Z',
        items: [{ name: 'Cafe', amountCents: 100, quantity: 1, confidence: 0.9 }],
        confidence: 0.9,
        confidenceByField: {
          merchant: 0.9,
          occurredAt: 0.9,
          currency: 0.9,
          totalCents: 0.9,
          subtotalCents: null,
          taxCents: null,
          tipCents: null,
          items: 0.9,
        },
      },
      maxAttempts: 3,
      canRetry: false,
      provider: 'tesseract',
    };
    const fetchMock = routeFetch({
      '/api/v1/auth/me': () => apiResponse(responses.me),
      [`/api/v1/groups/${responses.group.id}`]: () => apiResponse(responses.groupDetail),
      [`/api/v1/groups/${responses.group.id}/events/${responses.event.id}`]: () =>
        apiResponse(responses.eventDetail),
      [`/api/v1/groups/${responses.group.id}/categories`]: () => apiResponse(responses.categories),
      [`/api/v1/ocr/jobs/${jobId}`]: () => apiResponse(job),
      [`/api/v1/groups/${responses.group.id}/expenses`]: () => apiResponse(responses.expense, 201),
      [`/api/v1/groups/${responses.group.id}/expenses/${responses.expense.id}`]: () =>
        apiResponse(responses.expense),
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[
            `/app/groups/${responses.group.id}/events/${responses.event.id}/expenses/new?ocrJobId=${jobId}`,
          ]}
        >
          <Routes>
            <Route
              path="/app/groups/:groupId/events/:eventId/expenses/new"
              element={
                <AuthProvider>
                  <CreateExpensePage />
                </AuthProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Revisar gasto escaneado' }),
    ).toBeInTheDocument();
    const participantId = responses.event.participants[0].id;
    const participantMember = responses.groupDetail.members.find(
      (member) => member.id === responses.event.participants[0].groupMemberId,
    )!;
    fireEvent.click(screen.getByRole('checkbox', { name: participantMember.user.displayName }));
    fireEvent.change(screen.getByLabelText('Pagó el total'), {
      target: { value: responses.event.participants[0].id },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/expenses'),
        expect.anything(),
      ),
    );
    const expenseCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/expenses'));
    expect(JSON.parse((expenseCall?.[1] as RequestInit).body as string)).toMatchObject({
      splitMode: 'EXACT',
      items: [{ allocations: [{ eventParticipantId: participantId, amountCents: 100 }] }],
    });
  });

  it('mantiene el formulario manual y muestra el error si falla la consulta OCR', async () => {
    const jobId = '3a2f2d9b-4b5f-4c90-a1a4-8c2ed4f5b001';
    routeFetch({
      '/api/v1/auth/me': () => apiResponse(responses.me),
      [`/api/v1/groups/${responses.group.id}`]: () => apiResponse(responses.groupDetail),
      [`/api/v1/groups/${responses.group.id}/events/${responses.event.id}`]: () =>
        apiResponse(responses.eventDetail),
      [`/api/v1/groups/${responses.group.id}/categories`]: () => apiResponse(responses.categories),
      [`/api/v1/ocr/jobs/${jobId}`]: () =>
        apiError(
          'Un servicio externo no esta disponible; intenta mas tarde',
          503,
          'PROVIDER_UNAVAILABLE',
        ),
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[
            `/app/groups/${responses.group.id}/events/${responses.event.id}/expenses/new?ocrJobId=${jobId}`,
          ]}
        >
          <Routes>
            <Route
              path="/app/groups/:groupId/events/:eventId/expenses/new"
              element={
                <AuthProvider>
                  <CreateExpensePage />
                </AuthProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Revisar gasto escaneado' }),
    ).toBeInTheDocument();
    const ocrNotice = document.querySelector<HTMLElement>('.ocr-review-notice');
    expect(ocrNotice).toBeInTheDocument();
    expect(await within(ocrNotice!).findByRole('alert')).toHaveTextContent(
      'Un servicio externo no esta disponible; intenta mas tarde',
    );
    expect(screen.getByRole('button', { name: 'Registrar gasto' })).toBeInTheDocument();
  });
});
