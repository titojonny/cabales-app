import { describe, expect, it } from 'vitest';
import responses from '../test/fixtures/api-responses.json';
import * as modules from './module-schemas';
import * as core from './schemas';

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
});
