import { describe, expect, it } from 'vitest';
import { eventCommentSchema, publicSummarySchema } from './schemas';

describe('contratos P8', () => {
  it('acepta el resumen público sin correo ni campos sensibles', () => {
    const result = publicSummarySchema.safeParse({
      type: 'SETTLEMENT',
      expiresAt: '2026-10-10T00:00:00.000Z',
      groupName: 'Viaje',
      eventName: 'Cena',
      status: 'COMPLETED',
      currency: 'USD',
      totalCents: 1200,
      participants: [{ displayName: 'Ana' }],
      transfers: [{ debtor: 'Ana', creditor: 'Luis', amountCents: 1200, status: 'PENDING' }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect('email' in result.data).toBe(false);
  });

  it('mantiene comentarios como texto de longitud acotada', () => {
    expect(
      eventCommentSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        body: 'texto',
        authorUserId: '00000000-0000-4000-8000-000000000002',
        author: { id: '00000000-0000-4000-8000-000000000002', displayName: 'Ana', avatarUrl: null },
        createdAt: '2026-10-03T00:00:00.000Z',
        updatedAt: '2026-10-03T00:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      eventCommentSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        body: '<b>x</b>',
        authorUserId: '00000000-0000-4000-8000-000000000002',
        author: { id: '00000000-0000-4000-8000-000000000002', displayName: 'Ana', avatarUrl: null },
        createdAt: '2026-10-03T00:00:00.000Z',
        updatedAt: '2026-10-03T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});
