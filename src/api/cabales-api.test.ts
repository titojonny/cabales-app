import { afterEach, describe, expect, it, vi } from 'vitest';
import { cabalesApi } from './cabales-api';
import type { CreateExpenseInput } from './contracts';
import { clearCsrfToken } from './http';

const groupId = '22222222-2222-4222-8222-222222222222';
const eventId = '44444444-4444-4444-8444-444444444444';
const participantId = '55555555-5555-4555-8555-555555555555';
const expenseId = '66666666-6666-4666-8666-666666666666';
const settlementId = '99999999-9999-4999-8999-999999999999';
const transferId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const timestamp = '2026-08-21T12:00:00.000Z';

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const expenseResponse = {
  id: expenseId,
  groupId,
  eventId,
  title: 'Cena',
  notes: null,
  totalCents: 1200,
  currency: 'USD',
  splitMode: 'EQUAL',
  occurredAt: timestamp,
  createdAt: timestamp,
  participants: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      eventParticipantId: participantId,
      shareCents: 1200,
      eventParticipant: { guestName: 'Ana', groupMemberId: null },
    },
  ],
  payers: [
    {
      id: '88888888-8888-4888-8888-888888888888',
      amountCents: 1200,
      expenseParticipant: { eventParticipantId: participantId },
    },
  ],
  items: [],
};

const settlementResponse = {
  id: settlementId,
  groupId,
  eventId,
  status: 'OPEN',
  currency: 'USD',
  createdAt: timestamp,
  completedAt: null,
  transfers: [],
};

afterEach(() => {
  clearCsrfToken();
  document.cookie = 'cabales_session_csrf=; Max-Age=0; path=/';
  vi.unstubAllGlobals();
});

describe('cabalesApi financiero', () => {
  it('usa rutas anidadas, bodies reales y la clave recibida por el intento', async () => {
    document.cookie = 'cabales_session_csrf=csrf-for-api-route-tests-123; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(expenseResponse))
      .mockResolvedValueOnce(response(expenseResponse))
      .mockResolvedValueOnce(response(settlementResponse))
      .mockResolvedValueOnce(
        response({ id: transferId, status: 'PAID', amountCents: 1200, paidAt: timestamp }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const input: CreateExpenseInput = {
      eventId,
      title: 'Cena',
      totalCents: 1200,
      currency: 'USD',
      splitMode: 'EQUAL',
      occurredAt: timestamp,
      participants: [{ eventParticipantId: participantId }],
      payers: [{ eventParticipantId: participantId, amountCents: 1200 }],
    };

    await cabalesApi.createExpense(groupId, input, 'expense-attempt-key');
    await cabalesApi.expense(groupId, expenseId);
    await cabalesApi.createSettlement(groupId, eventId, 'settlement-attempt-key');
    await cabalesApi.markTransferPaid(groupId, settlementId, transferId);

    const createExpense = fetchMock.mock.calls[0];
    expect(createExpense[0]).toBe(`/api/v1/groups/${groupId}/expenses`);
    expect(JSON.parse(createExpense[1]?.body as string)).toEqual(input);
    expect((createExpense[1]?.headers as Headers).get('Idempotency-Key')).toBe(
      'expense-attempt-key',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/groups/${groupId}/expenses/${expenseId}`);
    const createSettlement = fetchMock.mock.calls[2];
    expect(JSON.parse(createSettlement[1]?.body as string)).toEqual({ eventId });
    expect((createSettlement[1]?.headers as Headers).get('Idempotency-Key')).toBe(
      'settlement-attempt-key',
    );
    expect(fetchMock.mock.calls[3][0]).toBe(
      `/api/v1/groups/${groupId}/settlements/${settlementId}/transfers/${transferId}/paid`,
    );
    expect(fetchMock.mock.calls[3][1]?.body).toBeUndefined();
  });

  it('envía displayName y colecciones explícitas al crear autenticación y evento', async () => {
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'ana@example.com',
      displayName: 'Ana',
      avatarUrl: null,
    };
    const createdEvent = {
      id: eventId,
      groupId,
      name: 'Cena',
      description: null,
      startsAt: timestamp,
      status: 'OPEN',
      createdAt: timestamp,
      participants: [{ id: participantId, groupMemberId: null, guestName: 'Ana' }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ user, csrfToken: 'csrf-from-register-response-123' }))
      .mockResolvedValueOnce(response(createdEvent));
    vi.stubGlobal('fetch', fetchMock);

    await cabalesApi.register({
      displayName: 'Ana',
      email: 'ana@example.com',
      password: 'password-secure-123',
    });
    await cabalesApi.createEvent(groupId, {
      name: 'Cena',
      startsAt: timestamp,
      memberIds: [],
      guests: [],
      links: [],
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      displayName: 'Ana',
      email: 'ana@example.com',
      password: 'password-secure-123',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/groups/${groupId}/events`);
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      name: 'Cena',
      startsAt: timestamp,
      memberIds: [],
      guests: [],
      links: [],
    });
  });

  it('integra invitaciones, lista de gastos y membresía actual con rutas reales', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const memberId = '33333333-3333-4333-8333-333333333333';
    const invitationToken = 'opaque-invitation-token-123456789';
    const invitation = {
      invitation: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        groupId,
        email: 'invitada@example.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: timestamp,
      },
      token: invitationToken,
    };
    const membership = { id: memberId, groupId, role: 'MEMBER', joinedAt: timestamp };
    const expenseList = [
      {
        id: expenseId,
        eventId,
        title: 'Cena',
        totalCents: 1200,
        currency: 'USD',
        splitMode: 'EQUAL',
        occurredAt: timestamp,
        createdAt: timestamp,
        _count: { participants: 2, items: 0 },
      },
    ];
    const groupDetail = {
      id: groupId,
      name: 'Viaje',
      description: null,
      currency: 'USD',
      createdAt: timestamp,
      updatedAt: timestamp,
      members: [
        {
          id: memberId,
          role: 'ADMIN',
          joinedAt: timestamp,
          user: {
            id: userId,
            email: 'ana@example.com',
            displayName: 'Ana',
            avatarUrl: null,
          },
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(invitation))
      .mockResolvedValueOnce(response(membership))
      .mockResolvedValueOnce(response(expenseList))
      .mockResolvedValueOnce(response(groupDetail));
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'cabales_session_csrf=csrf-for-collaboration-tests; path=/';

    await cabalesApi.createInvitation(groupId, {
      email: 'invitada@example.com',
      role: 'MEMBER',
    });
    await cabalesApi.acceptInvitation(invitationToken);
    const expenses = await cabalesApi.expenses(groupId);
    const group = await cabalesApi.group(groupId, userId);

    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/groups/${groupId}/invitations`);
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      token: invitationToken,
    });
    expect(fetchMock.mock.calls[2][0]).toBe(`/api/v1/groups/${groupId}/expenses`);
    expect(expenses[0]).toMatchObject({ participantCount: 2, itemCount: 0 });
    expect(group).toMatchObject({ currentRole: 'ADMIN', currentMemberId: memberId });
  });
});
