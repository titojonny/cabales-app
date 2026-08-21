import { z } from 'zod';

const id = z.string().uuid();
const date = z.string().datetime();
const currency = z.string().regex(/^[A-Z]{3}$/);
const cents = z.number().int().positive().max(2_147_483_647);
const role = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const eventStatus = z.enum(['OPEN', 'CLOSED', 'CANCELLED']);
const settlementStatus = z.enum(['OPEN', 'COMPLETED', 'CANCELLED']);
const transferStatus = z.enum(['PENDING', 'PAID', 'DISPUTED', 'CANCELLED']);

const rawUserSchema = z.strictObject({
  id,
  email: z.string().email().max(320),
  displayName: z.string().min(2).max(120),
  avatarUrl: z.string().url().nullable(),
});

const rawGroupBase = {
  id,
  name: z.string().min(2).max(120),
  description: z.string().max(500).nullable(),
  currency,
  createdAt: date,
  updatedAt: date,
};

const toDescription = (description: string | null) => description ?? undefined;

/** Valida respuestas auth con CSRF opcional, incluido `/me` cuando el backend lo emita. */
export const sessionSchema = z
  .strictObject({
    user: rawUserSchema,
    csrfToken: z.string().min(16).max(512).optional(),
  })
  .transform((session) => session);

/** Valida y adapta la forma observada de cada elemento de `GET /groups`. */
export const groupListSchema = z
  .array(
    z.strictObject({
      ...rawGroupBase,
      members: z.array(z.strictObject({ id, role })).length(1),
      _count: z.strictObject({
        members: z.number().int().nonnegative(),
        events: z.number().int().nonnegative(),
        expenses: z.number().int().nonnegative(),
      }),
    }),
  )
  .transform((groups) =>
    groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: toDescription(group.description),
      currency: group.currency,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: group.members,
      memberCount: group._count.members,
      eventCount: group._count.events,
      expenseCount: group._count.expenses,
      currentRole: group.members[0]?.role,
      currentMemberId: group.members[0]?.id,
    })),
  );

/** Valida y adapta el grupo reducido devuelto por creación. */
export const createdGroupSchema = z.strictObject(rawGroupBase).transform((group) => ({
  ...group,
  description: toDescription(group.description),
  currentRole: 'OWNER' as const,
}));

/** Valida y adapta miembros anidados de `GET /groups/:groupId`. */
export const groupDetailSchema = z
  .strictObject({
    ...rawGroupBase,
    members: z.array(
      z.strictObject({
        id,
        role,
        joinedAt: date,
        user: rawUserSchema,
      }),
    ),
  })
  .transform((group) => ({
    ...group,
    description: toDescription(group.description),
    memberCount: group.members.length,
  }));

/** Valida el token e invitación que el MVP entrega directamente al creador. */
export const createdInvitationSchema = z.strictObject({
  invitation: z.strictObject({
    id,
    groupId: id,
    email: z.string().email().max(320),
    role: z.enum(['ADMIN', 'MEMBER']),
    status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
    expiresAt: date,
  }),
  token: z.string().min(20).max(200),
});

/** Valida la membresía resultante de aceptar una invitación. */
export const acceptedInvitationSchema = z.strictObject({
  id,
  groupId: id,
  role,
  joinedAt: date,
});

const rawEventBase = {
  id,
  groupId: id,
  name: z.string().min(2).max(160),
  description: z.string().max(1000).nullable(),
  startsAt: date,
  status: eventStatus,
  createdAt: date,
};

const rawSettlementReference = z.strictObject({ id, status: settlementStatus });

/** Valida y adapta la colección de eventos con conteos y cierre opcional. */
export const eventListSchema = z
  .array(
    z.strictObject({
      ...rawEventBase,
      _count: z.strictObject({
        participants: z.number().int().nonnegative(),
        expenses: z.number().int().nonnegative(),
      }),
      settlement: rawSettlementReference.nullable(),
    }),
  )
  .transform((events) =>
    events.map((event) => ({
      id: event.id,
      groupId: event.groupId,
      name: event.name,
      description: toDescription(event.description),
      startsAt: event.startsAt,
      status: event.status,
      createdAt: event.createdAt,
      participantCount: event._count.participants,
      expenseCount: event._count.expenses,
      settlement: event.settlement ?? undefined,
    })),
  );

/** Valida la respuesta de creación, cuya membresía aún no incluye el usuario. */
export const createdEventSchema = z
  .strictObject({
    ...rawEventBase,
    participants: z.array(
      z.strictObject({ id, groupMemberId: id.nullable(), guestName: z.string().nullable() }),
    ),
  })
  .transform((event) => ({
    ...event,
    description: toDescription(event.description),
    participantCount: event.participants.length,
    participants: event.participants.map((participant) => ({
      id: participant.id,
      guestName: participant.guestName ?? undefined,
      groupMember: participant.groupMemberId ? { id: participant.groupMemberId } : null,
    })),
  }));

const rawEventParticipant = z.strictObject({
  id,
  guestName: z.string().nullable(),
  groupMember: z
    .strictObject({
      id,
      user: z.strictObject({
        id,
        displayName: z.string().min(2).max(120),
        avatarUrl: z.string().url().nullable(),
      }),
    })
    .nullable(),
});

/** Valida el padrón, enlaces, conteo y cierre de un evento detallado. */
export const eventDetailSchema = z
  .strictObject({
    ...rawEventBase,
    participants: z.array(rawEventParticipant),
    links: z.array(z.strictObject({ id, label: z.string().min(1).max(80), url: z.string().url() })),
    settlement: rawSettlementReference.extend({ createdAt: date }).strict().nullable(),
    _count: z.strictObject({ expenses: z.number().int().nonnegative() }),
  })
  .transform((event) => ({
    id: event.id,
    groupId: event.groupId,
    name: event.name,
    description: toDescription(event.description),
    startsAt: event.startsAt,
    status: event.status,
    createdAt: event.createdAt,
    participantCount: event.participants.length,
    expenseCount: event._count.expenses,
    participants: event.participants.map((participant) => ({
      id: participant.id,
      guestName: participant.guestName ?? undefined,
      groupMember: participant.groupMember,
    })),
    links: event.links,
    settlement: event.settlement ?? undefined,
  }));

const rawExpenseParticipant = z.strictObject({
  id,
  eventParticipantId: id,
  shareCents: cents,
  eventParticipant: z.strictObject({
    guestName: z.string().nullable(),
    groupMemberId: id.nullable(),
  }),
});

/** Valida y adapta los gastos reducidos de `GET /groups/:groupId/expenses`. */
export const expenseListSchema = z
  .array(
    z.strictObject({
      id,
      eventId: id,
      title: z.string().min(1).max(160),
      totalCents: cents,
      currency,
      splitMode: z.enum(['EQUAL', 'EXACT']),
      occurredAt: date,
      createdAt: date,
      _count: z.strictObject({
        participants: z.number().int().nonnegative(),
        items: z.number().int().nonnegative(),
      }),
    }),
  )
  .transform((expenses) =>
    expenses.map((expense) => ({
      id: expense.id,
      eventId: expense.eventId,
      title: expense.title,
      totalCents: expense.totalCents,
      currency: expense.currency,
      splitMode: expense.splitMode,
      occurredAt: expense.occurredAt,
      createdAt: expense.createdAt,
      participantCount: expense._count.participants,
      itemCount: expense._count.items,
    })),
  );

/** Valida el gasto completo y aplana la referencia anidada de cada pagador. */
export const expenseDetailSchema = z
  .strictObject({
    id,
    groupId: id,
    eventId: id,
    title: z.string().min(1).max(160),
    notes: z.string().max(1000).nullable(),
    totalCents: cents,
    currency,
    splitMode: z.enum(['EQUAL', 'EXACT']),
    occurredAt: date,
    createdAt: date,
    participants: z.array(rawExpenseParticipant),
    payers: z.array(
      z.strictObject({
        id,
        amountCents: cents,
        expenseParticipant: z.strictObject({ eventParticipantId: id }),
      }),
    ),
    items: z.array(
      z.strictObject({
        id,
        name: z.string().min(1).max(160),
        amountCents: cents,
        quantity: z.number().int().positive(),
        allocations: z.array(
          z.strictObject({
            amountCents: cents,
            expenseParticipant: z.strictObject({ eventParticipantId: id }),
          }),
        ),
      }),
    ),
  })
  .transform((expense) => ({
    id: expense.id,
    groupId: expense.groupId,
    eventId: expense.eventId,
    title: expense.title,
    notes: expense.notes ?? undefined,
    totalCents: expense.totalCents,
    currency: expense.currency,
    splitMode: expense.splitMode,
    occurredAt: expense.occurredAt,
    createdAt: expense.createdAt,
    participants: expense.participants.map((participant) => ({
      ...participant,
      eventParticipant: {
        guestName: participant.eventParticipant.guestName ?? undefined,
        groupMemberId: participant.eventParticipant.groupMemberId ?? undefined,
      },
    })),
    payers: expense.payers.map((payer) => ({
      id: payer.id,
      eventParticipantId: payer.expenseParticipant.eventParticipantId,
      amountCents: payer.amountCents,
    })),
    items: expense.items.map((item) => ({
      id: item.id,
      name: item.name,
      amountCents: item.amountCents,
      quantity: item.quantity,
      allocations: item.allocations.map((allocation) => ({
        eventParticipantId: allocation.expenseParticipant.eventParticipantId,
        amountCents: allocation.amountCents,
      })),
    })),
  }));

const rawSettlementSummary = {
  id,
  eventId: id,
  status: settlementStatus,
  currency,
  createdAt: date,
  completedAt: date.nullable(),
};

/** Valida y adapta resúmenes de cierre con su conteo real de transferencias. */
export const settlementListSchema = z
  .array(
    z.strictObject({
      ...rawSettlementSummary,
      _count: z.strictObject({ transfers: z.number().int().nonnegative() }),
    }),
  )
  .transform((settlements) =>
    settlements.map((settlement) => ({
      id: settlement.id,
      eventId: settlement.eventId,
      status: settlement.status,
      currency: settlement.currency,
      createdAt: settlement.createdAt,
      completedAt: settlement.completedAt ?? undefined,
      transferCount: settlement._count.transfers,
    })),
  );

const rawTransferSide = z.strictObject({
  guestName: z.string().nullable(),
  groupMemberId: id.nullable(),
});

const rawTransfer = z.strictObject({
  id,
  debtorParticipantId: id,
  creditorParticipantId: id,
  amountCents: cents,
  status: transferStatus,
  paidAt: date.nullable(),
  debtor: rawTransferSide,
  creditor: rawTransferSide,
  history: z.array(
    z.strictObject({
      fromStatus: transferStatus.nullable(),
      toStatus: transferStatus,
      createdAt: date,
    }),
  ),
});

/** Valida el cierre detallado y conserva únicamente datos necesarios en la UI. */
export const settlementDetailSchema = z
  .strictObject({
    id,
    groupId: id,
    eventId: id,
    status: settlementStatus,
    currency,
    createdAt: date,
    completedAt: date.nullable(),
    transfers: z.array(rawTransfer),
  })
  .transform((settlement) => ({
    id: settlement.id,
    groupId: settlement.groupId,
    eventId: settlement.eventId,
    status: settlement.status,
    currency: settlement.currency,
    createdAt: settlement.createdAt,
    completedAt: settlement.completedAt ?? undefined,
    transfers: settlement.transfers.map((transfer) => ({
      id: transfer.id,
      debtorParticipantId: transfer.debtorParticipantId,
      creditorParticipantId: transfer.creditorParticipantId,
      amountCents: transfer.amountCents,
      status: transfer.status,
      paidAt: transfer.paidAt ?? undefined,
      debtor: {
        guestName: transfer.debtor.guestName ?? undefined,
        groupMemberId: transfer.debtor.groupMemberId ?? undefined,
      },
      creditor: {
        guestName: transfer.creditor.guestName ?? undefined,
        groupMemberId: transfer.creditor.groupMemberId ?? undefined,
      },
      history: transfer.history.map((entry) => ({
        fromStatus: entry.fromStatus ?? undefined,
        toStatus: entry.toStatus,
        createdAt: entry.createdAt,
      })),
    })),
  }));

/** Valida la respuesta reducida del endpoint para marcar un pago. */
export const paidTransferSchema = z.strictObject({
  id,
  status: z.literal('PAID'),
  amountCents: cents,
  paidAt: date,
});
