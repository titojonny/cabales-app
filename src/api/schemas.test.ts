import { describe, expect, it } from 'vitest';
import {
  eventDetailSchema,
  expenseDetailSchema,
  groupDetailSchema,
  groupListSchema,
  settlementDetailSchema,
  settlementListSchema,
  sessionSchema,
} from './schemas';

const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  group: '22222222-2222-4222-8222-222222222222',
  member: '33333333-3333-4333-8333-333333333333',
  event: '44444444-4444-4444-8444-444444444444',
  participant: '55555555-5555-4555-8555-555555555555',
  expense: '66666666-6666-4666-8666-666666666666',
  expenseParticipant: '77777777-7777-4777-8777-777777777777',
  payer: '88888888-8888-4888-8888-888888888888',
  settlement: '99999999-9999-4999-8999-999999999999',
  transfer: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};
const timestamp = '2026-08-21T12:00:00.000Z';
const user = {
  id: ids.user,
  email: 'ana@example.com',
  displayName: 'Ana',
  avatarUrl: null,
};

describe('adaptadores de respuesta', () => {
  it('acepta auth con o sin CSRF y adapta las dos formas reales de grupo', () => {
    expect(sessionSchema.parse({ user })).toEqual({ user });
    expect(sessionSchema.parse({ user, csrfToken: 'csrf-from-updated-me-response' })).toEqual({
      user,
      csrfToken: 'csrf-from-updated-me-response',
    });
    expect(sessionSchema.safeParse({ user, unexpected: true }).success).toBe(false);
    const list = groupListSchema.parse([
      {
        id: ids.group,
        name: 'Viaje',
        description: null,
        currency: 'USD',
        createdAt: timestamp,
        updatedAt: timestamp,
        members: [{ id: ids.member, role: 'OWNER' }],
        _count: { members: 3, events: 2, expenses: 4 },
      },
    ]);
    expect(list[0]).toMatchObject({
      memberCount: 3,
      eventCount: 2,
      expenseCount: 4,
      currentRole: 'OWNER',
      currentMemberId: ids.member,
    });
    const detail = groupDetailSchema.parse({
      id: ids.group,
      name: 'Viaje',
      description: null,
      currency: 'USD',
      createdAt: timestamp,
      updatedAt: timestamp,
      members: [{ id: ids.member, role: 'OWNER', joinedAt: timestamp, user }],
    });
    expect(detail.members[0]?.user.displayName).toBe('Ana');
  });

  it('adapta padrón de evento y referencias financieras sin inventar nombres', () => {
    const event = eventDetailSchema.parse({
      id: ids.event,
      groupId: ids.group,
      name: 'Cena',
      description: null,
      startsAt: timestamp,
      status: 'OPEN',
      createdAt: timestamp,
      participants: [
        {
          id: ids.participant,
          guestName: null,
          groupMember: {
            id: ids.member,
            user: { id: ids.user, displayName: 'Ana', avatarUrl: null },
          },
        },
      ],
      links: [],
      settlement: null,
      _count: { expenses: 1 },
    });
    expect(event.participants[0]?.groupMember?.user?.displayName).toBe('Ana');

    const expense = expenseDetailSchema.parse({
      id: ids.expense,
      groupId: ids.group,
      eventId: ids.event,
      title: 'Cena',
      notes: null,
      totalCents: 2500,
      currency: 'USD',
      splitMode: 'EQUAL',
      occurredAt: timestamp,
      createdAt: timestamp,
      participants: [
        {
          id: ids.expenseParticipant,
          eventParticipantId: ids.participant,
          shareCents: 2500,
          eventParticipant: { guestName: null, groupMemberId: ids.member },
        },
      ],
      payers: [
        {
          id: ids.payer,
          amountCents: 2500,
          expenseParticipant: { eventParticipantId: ids.participant },
        },
      ],
      items: [
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          name: 'Plato',
          amountCents: 2500,
          quantity: 1,
          allocations: [
            {
              amountCents: 2500,
              expenseParticipant: { eventParticipantId: ids.participant },
            },
          ],
        },
      ],
    });
    expect(expense.payers[0]).toEqual({
      id: ids.payer,
      eventParticipantId: ids.participant,
      amountCents: 2500,
    });
    expect(expense.participants[0]?.eventParticipant.guestName).toBeUndefined();
    expect(expense.items[0]?.allocations[0]).toEqual({
      eventParticipantId: ids.participant,
      amountCents: 2500,
    });
  });

  it('distingue resúmenes de cierre, detalles y estados de transferencia', () => {
    const list = settlementListSchema.parse([
      {
        id: ids.settlement,
        eventId: ids.event,
        status: 'OPEN',
        currency: 'USD',
        createdAt: timestamp,
        completedAt: null,
        _count: { transfers: 1 },
      },
    ]);
    expect(list[0]).toMatchObject({ status: 'OPEN', transferCount: 1 });
    const detail = settlementDetailSchema.parse({
      id: ids.settlement,
      groupId: ids.group,
      eventId: ids.event,
      status: 'OPEN',
      currency: 'USD',
      createdAt: timestamp,
      completedAt: null,
      transfers: [
        {
          id: ids.transfer,
          debtorParticipantId: ids.participant,
          creditorParticipantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          amountCents: 1250,
          status: 'PENDING',
          paidAt: null,
          debtor: { guestName: null, groupMemberId: ids.member },
          creditor: { guestName: 'Invitado', groupMemberId: null },
          history: [{ fromStatus: null, toStatus: 'PENDING', createdAt: timestamp }],
        },
      ],
    });
    expect(detail.transfers[0]).toMatchObject({ status: 'PENDING', amountCents: 1250 });
    expect(detail.transfers[0]?.history[0]).toEqual({
      fromStatus: undefined,
      toStatus: 'PENDING',
      createdAt: timestamp,
    });

    expect(
      settlementDetailSchema.parse({
        ...detail,
        completedAt: null,
        status: 'CANCELLED',
        transfers: [
          {
            ...detail.transfers[0],
            paidAt: null,
            status: 'DISPUTED',
            debtor: { guestName: null, groupMemberId: ids.member },
            creditor: { guestName: 'Invitado', groupMemberId: null },
            history: [{ fromStatus: 'PENDING', toStatus: 'DISPUTED', createdAt: timestamp }],
          },
        ],
      }).status,
    ).toBe('CANCELLED');
  });
});
