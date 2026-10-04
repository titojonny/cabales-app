import { describe, expect, it } from 'vitest';
import responses from '../test/fixtures/api-responses.json';
import * as modules from './module-schemas';
import * as core from './schemas';

const timestamp = '2026-10-03T12:00:00.000Z';

/**
 * Respuestas reales capturadas de la API 1.2.0 (flujo de integración) y saneadas.
 * Protege el contrato: si la API cambia una forma, estos adaptadores lo detectan antes que la UI.
 */
const cases: Array<[keyof typeof responses, { parse: (value: unknown) => unknown }]> = [
  ['register', core.sessionSchema],
  ['me', core.sessionSchema],
  ['invite', core.createdInvitationSchema],
  ['invitations', core.invitationListSchema],
  ['preview', core.invitationPreviewSchema],
  ['accept', core.acceptedInvitationSchema],
  ['groupDetail', core.groupDetailSchema],
  ['expense', core.expenseDetailSchema],
  ['category', modules.categorySchema],
  ['categories', modules.categoryListSchema],
  ['budget', modules.budgetSchema],
  ['budgetDetail', modules.budgetDetailSchema],
  ['cabudas', modules.cabudasSummarySchema],
  ['cabudasOpen', modules.cabudasSummarySchema],
  ['cabudasHistory', modules.cabudasHistorySchema],
  ['stats', modules.statisticsSchema],
  ['fund', modules.fundSchema],
  ['funds', modules.fundListSchema],
  ['fundDetail', modules.fundDetailSchema],
  ['movement', modules.createdMovementSchema],
  ['movements', modules.fundMovementListSchema],
  ['document', modules.documentSchema],
  ['documents', modules.documentListSchema],
  ['downloadUrl', modules.downloadUrlSchema],
  ['grants', modules.documentGrantListSchema],
  ['ocrCreate', modules.ocrJobSchema],
  ['ocrJob', modules.ocrJobSchema],
  ['notifications', modules.notificationListSchema],
  ['unread', modules.unreadCountSchema],
  ['prefs', modules.notificationPreferencesSchema],
  ['achievements', modules.achievementListSchema],
  ['privacyCreate', modules.privacyRequestSchema],
  ['privacyConfirm', modules.privacyRequestSchema],
  ['privacyList', modules.privacyRequestListSchema],
];

describe('contrato de módulos con respuestas reales', () => {
  it.each(cases)('acepta %s', (key, schema) => {
    expect(() => schema.parse(responses[key])).not.toThrow();
  });

  it('expone verificación de correo y entrega de invitación sin perder campos', () => {
    const session = core.sessionSchema.parse(responses.register);
    expect(session.user).toMatchObject({ locale: 'es', emailVerified: false });
    const created = core.createdInvitationSchema.parse(responses.invite);
    expect(created.delivery).toBe('email');
    expect(created.invitation.invitedBy?.displayName).toBe('Ana');
  });

  it('tolera tipos nuevos de aviso pero rechaza estados desconocidos y montos no enteros', () => {
    const [first] = responses.notifications;
    expect(modules.notificationSchema.safeParse({ ...first, type: 'modulo.nuevo' }).success).toBe(
      true,
    );
    expect(modules.notificationSchema.safeParse({ ...first, status: 'DELETED' }).success).toBe(
      false,
    );
    expect(modules.fundSchema.safeParse({ ...responses.fund, balanceCents: 1.5 }).success).toBe(
      false,
    );
  });

  it('valida preferencias de aportes y niveles de insignias P6', () => {
    const preferences = modules.notificationPreferencesSchema.parse({
      preferences: [
        { type: 'fund.contribution_due', inApp: true, email: false, push: true },
        { type: 'fund.contribution_overdue', inApp: true, email: true, push: true },
      ],
      channels: { inApp: true, email: true, push: true },
    });
    expect(preferences.preferences[0]?.type).toBe('fund.contribution_due');
    const [achievement] = modules.achievementListSchema.parse([
      {
        code: 'FUND_KING',
        name: 'Rey de las cabudas',
        description: 'Registra aportes.',
        category: 'CABUDAS',
        target: 15,
        progress: 5,
        status: 'UNLOCKED',
        awardedAt: timestamp,
        currentLevel: 'SILVER',
        points: 2,
        levels: [
          { level: 'BRONZE', threshold: 1, points: 1, achieved: true },
          { level: 'SILVER', threshold: 5, points: 2, achieved: true },
          { level: 'GOLD', threshold: 15, points: 3, achieved: false },
        ],
      },
    ]);
    expect(achievement?.currentLevel).toBe('SILVER');
  });

  it('acepta categorias globales y propuestas OCR con items nombrados', () => {
    expect(
      modules.categorySchema.parse({
        id: '10000000-0000-4000-8000-000000000001',
        groupId: null,
        name: 'Comida',
        color: null,
      }).groupId,
    ).toBeNull();
    expect(
      modules.ocrProposalSchema.parse({
        items: [{ name: 'Pupusa', amountCents: 250 }],
      }).items,
    ).toEqual([{ name: 'Pupusa', amountCents: 250 }]);
  });

  it('valida el registro de ingreso personal sin aceptar un importe decimal', () => {
    const valid = {
      id: '10000000-0000-4000-8000-000000000001',
      amountCents: 125000,
      date: timestamp,
      category: 'Salario',
      note: null,
      currency: 'USD',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    expect(modules.incomeSchema.safeParse(valid).success).toBe(true);
    expect(modules.incomeSchema.safeParse({ ...valid, amountCents: 10.5 }).success).toBe(false);
  });
  it('acepta contratos P5 de categorías, enlaces y bloqueo', () => {
    const document = modules.documentSchema.parse({
      ...responses.document,
      category: 'IDENTIDAD',
      expiresAt: '2026-10-20T00:00:00.000Z',
      expiryNoticeDays: [30, 7],
      isLegacy: false,
      isPinned: true,
    });
    expect(document.category).toBe('IDENTIDAD');
    expect(
      modules.sharedLinkSchema.parse({
        id: '10000000-0000-4000-8000-000000000001',
        expiresAt: '2026-10-05T00:00:00.000Z',
        maxAccesses: 3,
        accessCount: 0,
        lastAccessAt: null,
        revokedAt: null,
        createdAt: '2026-10-03T00:00:00.000Z',
      }).maxAccesses,
    ).toBe(3);
    expect(
      modules.documentLockStatusSchema.parse({
        enabled: true,
        pinEnabled: true,
        webauthnEnabled: false,
        webauthnAvailable: true,
        unlockedUntil: null,
        unlockTtlMinutes: 10,
      }).enabled,
    ).toBe(true);
  });
});
