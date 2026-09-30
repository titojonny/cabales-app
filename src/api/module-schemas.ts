import { z } from 'zod';

/*
 * Contratos de los módulos de la API 1.2. A diferencia de los esquemas del MVP, estos objetos
 * ignoran campos adicionales para que una ampliación compatible del backend no rompa la PWA;
 * los campos presentes sí se validan de forma estricta.
 */

const id = z.string().uuid();
const date = z.string().datetime();
const nullableDate = date.nullable();
const currency = z.string().regex(/^[A-Z]{3}$/);
const int = z.number().int();
const userRef = z.object({ id, displayName: z.string() });

/** Categoría propia del grupo. */
export const categorySchema = z.object({
  id,
  groupId: id,
  name: z.string(),
  color: z.string().nullable(),
});
export const categoryListSchema = z.array(categorySchema);

const alert = z.enum(['OK', 'WARNING', 'EXCEEDED']);
const budgetProgress = z.object({
  periodStart: date,
  periodEnd: date,
  periodState: z.enum(['UPCOMING', 'ACTIVE', 'ENDED']),
  spentCents: int,
  expenseCount: int,
  remainingCents: int,
  overspentCents: int,
  progressPercent: z.number(),
  alert,
});

/** Presupuesto con el progreso del periodo vigente. */
export const budgetSchema = z.object({
  id,
  groupId: id,
  name: z.string(),
  amountCents: int,
  currency,
  period: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM']),
  startsAt: date,
  endsAt: nullableDate,
  alertThresholdPercent: int,
  category: z.object({ id, name: z.string(), color: z.string().nullable() }).nullable(),
  current: budgetProgress,
});
export const budgetListSchema = z.array(budgetSchema);
export const budgetDetailSchema = budgetSchema.extend({
  history: z.array(
    z.object({ periodStart: date, periodEnd: date, spentCents: int, expenseCount: int }),
  ),
});

const fundRole = z.enum(['MANAGER', 'MEMBER']);
const fundBase = z.object({
  id,
  groupId: id,
  name: z.string(),
  description: z.string().nullable(),
  currency,
  archivedAt: nullableDate,
  createdAt: date,
  balanceCents: int,
  myRole: fundRole.nullable(),
  canManage: z.boolean(),
});

/** Fondo común con saldo derivado de movimientos. */
export const fundSchema = fundBase.extend({
  memberCount: int.optional(),
  movementCount: int.optional(),
});
export const fundListSchema = z.array(fundSchema);
const movementType = z.enum(['CONTRIBUTION', 'WITHDRAWAL', 'ADJUSTMENT']);
export const fundDetailSchema = fundBase.extend({
  canContribute: z.boolean(),
  totals: z.record(z.string(), z.object({ totalCents: int, count: int })),
  members: z.array(
    z.object({
      id,
      role: fundRole,
      joinedAt: date,
      groupMemberId: id,
      user: z.object({ id, displayName: z.string(), avatarUrl: z.string().nullable() }),
    }),
  ),
});
export const fundMovementSchema = z.object({
  id,
  type: movementType,
  amountCents: int,
  description: z.string().nullable(),
  createdAt: date,
  createdBy: userRef.nullable(),
});
export const fundMovementListSchema = z.array(fundMovementSchema);
export const createdMovementSchema = z.object({
  movement: fundMovementSchema,
  balanceCents: int,
});

const access = z.enum(['VIEW', 'EDIT', 'MANAGE']);

/** Documento privado; la clave de almacenamiento nunca llega al cliente. */
export const documentSchema = z.object({
  id,
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: int.nullable(),
  groupId: id.nullable(),
  eventId: id.nullable(),
  expenseId: id.nullable(),
  settlementId: id.nullable(),
  createdAt: date,
  updatedAt: date,
  owner: userRef,
  access,
});
export const documentListSchema = z.array(documentSchema);
export const downloadUrlSchema = z.object({ url: z.string().url(), expiresAt: date });
export const documentGrantSchema = z.object({
  userId: id,
  displayName: z.string(),
  access,
  createdAt: date,
});
export const documentGrantListSchema = z.array(documentGrantSchema);

/** Propuesta del OCR: solo sugiere datos, nunca crea ni modifica gastos. */
export const ocrProposalSchema = z.object({
  merchant: z.string().nullable().optional(),
  totalCents: int.nullable().optional(),
  currency: z.string().nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  items: z.array(z.object({ description: z.string(), amountCents: int })).default([]),
  confidence: z.number().min(0).max(1).optional(),
});
export const ocrJobSchema = z.object({
  id,
  documentId: id.nullable(),
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']),
  attempts: int,
  errorCode: z.string().nullable(),
  createdAt: date,
  finishedAt: nullableDate,
  confirmedAt: nullableDate,
  confirmedExpenseId: id.nullable(),
  proposal: ocrProposalSchema.nullable(),
  maxAttempts: int,
  canRetry: z.boolean(),
  provider: z.string(),
});
export const ocrJobListSchema = z.array(ocrJobSchema);

const counterparty = z.object({
  userId: id.nullable(),
  displayName: z.string(),
  isGuest: z.boolean(),
});
const direction = z.enum(['PAY', 'RECEIVE']);
const transferStatus = z.enum(['PENDING', 'PAID', 'DISPUTED', 'CANCELLED']);
export const cabudasTransferSchema = z.object({
  transferId: id,
  settlementId: id,
  groupId: id,
  groupName: z.string(),
  eventId: id,
  eventName: z.string(),
  direction,
  counterparty,
  amountCents: int,
  currency,
  status: transferStatus,
  paidAt: nullableDate,
  createdAt: date,
});
export const cabudasHistorySchema = z.array(cabudasTransferSchema);

/** Deudas consolidadas del usuario; nunca mezcla monedas. */
export const cabudasSummarySchema = z.object({
  totals: z.array(z.object({ currency, owedToMeCents: int, iOweCents: int, netCents: int })),
  groups: z.array(
    z.object({
      groupId: id,
      groupName: z.string(),
      currency,
      owedToMeCents: int,
      iOweCents: int,
      netCents: int,
    }),
  ),
  people: z.array(z.object({ counterparty, groupId: id.nullable(), currency, netCents: int })),
  simplifiedTransfers: z.array(
    z.object({ direction, counterparty, groupId: id.nullable(), currency, amountCents: int }),
  ),
  pendingTransfers: z.array(cabudasTransferSchema),
  openEvents: z.array(
    z.object({
      eventId: id,
      eventName: z.string(),
      groupId: id,
      groupName: z.string(),
      currency,
      myNetCents: int,
    }),
  ),
});

/** Agregados de gasto calculados en servidor sobre datos autorizados. */
export const statisticsSchema = z.object({
  range: z.object({ from: date, to: date }),
  currency: currency.nullable(),
  availableCurrencies: z.array(currency),
  granularity: z.enum(['week', 'month']),
  totals: z.object({
    spentCents: int,
    expenseCount: int,
    myShareCents: int,
    myPaidCents: int,
    averageExpenseCents: int,
  }),
  byCategory: z.array(
    z.object({
      categoryId: id.nullable(),
      name: z.string(),
      color: z.string().nullable(),
      totalCents: int,
      count: int,
    }),
  ),
  byGroup: z.array(z.object({ groupId: id, name: z.string(), totalCents: int, count: int })),
  byEvent: z.array(
    z.object({ eventId: id, name: z.string(), groupId: id, totalCents: int, count: int }),
  ),
  byPerson: z.array(
    z.object({
      userId: id.nullable(),
      displayName: z.string(),
      paidCents: int,
      shareCents: int,
    }),
  ),
  trend: z.array(z.object({ period: z.string(), totalCents: int, myShareCents: int })),
  budgets: z.array(
    z.object({
      budgetId: id,
      name: z.string(),
      groupId: id,
      amountCents: int,
      spentCents: int,
      progressPercent: z.number(),
      alert,
    }),
  ),
});

/** Tipos de aviso con preferencias configurables. */
export const NOTIFICATION_TYPES = [
  'invitation.received',
  'invitation.accepted',
  'settlement.created',
  'transfer.paid',
  'budget.threshold',
  'fund.movement',
  'ocr.finished',
  'privacy.updated',
  'achievement.unlocked',
] as const;
export const notificationSchema = z.object({
  id,
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED']),
  createdAt: date,
  readAt: nullableDate,
});
export const notificationListSchema = z.array(notificationSchema);
export const unreadCountSchema = z.object({ unread: int.nonnegative() });
export const notificationPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      type: z.enum(NOTIFICATION_TYPES),
      inApp: z.boolean(),
      email: z.boolean(),
      push: z.boolean(),
    }),
  ),
  channels: z.object({ inApp: z.boolean(), email: z.boolean(), push: z.boolean() }),
});
export const pushConfigSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
});

/** Logro con progreso transparente. */
export const achievementSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  target: int,
  progress: int,
  status: z.enum(['LOCKED', 'IN_PROGRESS', 'UNLOCKED']),
  awardedAt: nullableDate,
});
export const achievementListSchema = z.array(achievementSchema);

const privacyType = z.enum(['ACCESS', 'RECTIFICATION', 'ERASURE', 'OBJECTION', 'PORTABILITY']);
/** Solicitud ARCO-POL propia. */
export const privacyRequestSchema = z.object({
  id,
  type: privacyType,
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED']),
  reason: z.string().nullable(),
  createdAt: date,
  completedAt: nullableDate,
  exportExpiresAt: nullableDate,
  exportAvailable: z.boolean(),
  requiresPassword: z.boolean(),
});
export const privacyRequestListSchema = z.array(privacyRequestSchema);

export type Category = z.output<typeof categorySchema>;
export type Budget = z.output<typeof budgetSchema>;
export type BudgetDetail = z.output<typeof budgetDetailSchema>;
export type BudgetAlert = z.output<typeof alert>;
export type Fund = z.output<typeof fundSchema>;
export type FundDetail = z.output<typeof fundDetailSchema>;
export type FundMovement = z.output<typeof fundMovementSchema>;
export type FundMovementType = z.output<typeof movementType>;
export type Document = z.output<typeof documentSchema>;
export type DocumentAccess = z.output<typeof access>;
export type DocumentGrant = z.output<typeof documentGrantSchema>;
export type OcrJob = z.output<typeof ocrJobSchema>;
export type CabudasSummary = z.output<typeof cabudasSummarySchema>;
export type CabudasTransfer = z.output<typeof cabudasTransferSchema>;
export type Statistics = z.output<typeof statisticsSchema>;
export type Notification = z.output<typeof notificationSchema>;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationPreferences = z.output<typeof notificationPreferencesSchema>;
export type PushConfig = z.output<typeof pushConfigSchema>;
export type Achievement = z.output<typeof achievementSchema>;
export type PrivacyRequest = z.output<typeof privacyRequestSchema>;
export type PrivacyRequestType = z.output<typeof privacyType>;
