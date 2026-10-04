import { describe, expect, it } from 'vitest';
import { personalExpenseSchema, recurringExpenseSchema, tagSchema } from './module-schemas';

const userId = '10000000-0000-4000-8000-000000000001';
const expenseId = '20000000-0000-4000-8000-000000000002';

describe('contratos P4', () => {
  it('acepta un gasto personal sin grupo ni evento y sus etiquetas', () => {
    const expense = personalExpenseSchema.parse({
      id: expenseId,
      groupId: null,
      eventId: null,
      ownerUserId: userId,
      title: 'Suscripción',
      notes: null,
      totalCents: 999,
      subtotalCents: 999,
      taxCents: 0,
      tipCents: 0,
      currency: 'USD',
      splitMode: 'EQUAL',
      occurredAt: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      categoryId: null,
      category: null,
      tags: [{ tag: { id: expenseId, name: 'fijo' } }],
    });
    expect(expense.ownerUserId).toBe(userId);
    expect(expense.tags[0]?.tag.name).toBe('fijo');
  });

  it('rechaza una etiqueta con id no UUID y acepta un recurrente pausado', () => {
    expect(
      tagSchema.safeParse({ id: 'no-id', groupId: null, ownerUserId: userId, name: 'x' }).success,
    ).toBe(false);
    const recurring = recurringExpenseSchema.parse({
      id: expenseId,
      groupId: null,
      eventId: null,
      ownerUserId: userId,
      createdById: userId,
      title: 'Renta',
      notes: null,
      amountCents: 50000,
      currency: 'USD',
      categoryId: null,
      frequency: 'MONTHLY',
      chargeDay: 1,
      nextRunAt: '2026-11-01T00:00:00.000Z',
      endsAt: null,
      isActive: false,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      participants: [],
      tags: [],
    });
    expect(recurring.isActive).toBe(false);
  });
});
