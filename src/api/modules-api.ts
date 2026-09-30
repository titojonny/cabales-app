import { z } from 'zod';
import type { CreatedInvitation, Invitation, InvitationPreview, User } from './contracts';
import { request, requestFile, requestWithMeta } from './http';
import {
  achievementListSchema,
  budgetDetailSchema,
  budgetListSchema,
  budgetSchema,
  cabudasHistorySchema,
  cabudasSummarySchema,
  categoryListSchema,
  categorySchema,
  createdMovementSchema,
  documentGrantListSchema,
  documentGrantSchema,
  documentListSchema,
  documentSchema,
  downloadUrlSchema,
  fundDetailSchema,
  fundListSchema,
  fundMovementListSchema,
  fundSchema,
  notificationListSchema,
  notificationPreferencesSchema,
  notificationSchema,
  ocrJobListSchema,
  ocrJobSchema,
  pushConfigSchema,
  privacyRequestListSchema,
  privacyRequestSchema,
  statisticsSchema,
  unreadCountSchema,
  type DocumentAccess,
  type FundMovementType,
  type NotificationPreferences,
  type PrivacyRequestType,
} from './module-schemas';
import {
  createdInvitationSchema,
  invitationListSchema,
  invitationPreviewSchema,
  sessionSchema,
} from './schemas';

const enc = encodeURIComponent;
const acceptedSchema = z.object({ accepted: z.literal(true) });
const userEnvelopeSchema = sessionSchema.transform((session) => session.user);

/** Construye una query string omitiendo valores vacíos. */
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Adaptador de los módulos de la API 1.2 (identidad ampliada, invitaciones y módulos). */
export const modulesApi = {
  // Identidad: respuestas 202 idénticas exista o no la cuenta.
  requestEmailVerification: (email: string) =>
    request('/auth/email-verification/request', {
      method: 'POST',
      body: { email },
      schema: acceptedSchema,
    }),
  verifyEmail: (token: string) =>
    request<User>('/auth/email-verification/confirm', {
      method: 'POST',
      body: { token },
      schema: userEnvelopeSchema,
    }),
  requestPasswordRecovery: (email: string) =>
    request('/auth/password-recovery/request', {
      method: 'POST',
      body: { email },
      schema: acceptedSchema,
    }),
  resetPassword: (token: string, password: string) =>
    request('/auth/password-recovery/confirm', {
      method: 'POST',
      body: { token, password },
      schema: z.object({ reset: z.literal(true) }),
    }),
  updateProfile: (input: { displayName?: string; locale?: 'es' | 'en' }) =>
    request<User>('/auth/me', { method: 'PATCH', body: input, schema: userEnvelopeSchema }),

  // Invitaciones.
  invitations: (groupId: string) =>
    request<Invitation[]>(`/groups/${enc(groupId)}/invitations`, {
      schema: invitationListSchema,
    }),
  resendInvitation: (groupId: string, invitationId: string) =>
    request<CreatedInvitation>(`/groups/${enc(groupId)}/invitations/${enc(invitationId)}/resend`, {
      method: 'POST',
      schema: createdInvitationSchema,
    }),
  revokeInvitation: (groupId: string, invitationId: string) =>
    request(`/groups/${enc(groupId)}/invitations/${enc(invitationId)}/revoke`, {
      method: 'POST',
    }),
  previewInvitation: (token: string) =>
    request<InvitationPreview>('/groups/invitations/preview', {
      method: 'POST',
      body: { token },
      schema: invitationPreviewSchema,
    }),

  // Categorías.
  categories: (groupId: string) =>
    request(`/groups/${enc(groupId)}/categories`, { schema: categoryListSchema }),
  createCategory: (groupId: string, input: { name: string; color?: string }) =>
    request(`/groups/${enc(groupId)}/categories`, {
      method: 'POST',
      body: input,
      schema: categorySchema,
    }),
  deleteCategory: (groupId: string, categoryId: string) =>
    request(`/groups/${enc(groupId)}/categories/${enc(categoryId)}`, { method: 'DELETE' }),

  // Presupuestos.
  budgets: (groupId: string) =>
    request(`/groups/${enc(groupId)}/budgets`, { schema: budgetListSchema }),
  budget: (groupId: string, budgetId: string) =>
    request(`/groups/${enc(groupId)}/budgets/${enc(budgetId)}`, { schema: budgetDetailSchema }),
  createBudget: (
    groupId: string,
    input: {
      name: string;
      amountCents: number;
      period: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
      startsAt: string;
      endsAt?: string | null;
      categoryId?: string | null;
      alertThresholdPercent: number;
    },
  ) =>
    request(`/groups/${enc(groupId)}/budgets`, {
      method: 'POST',
      body: input,
      schema: budgetSchema,
    }),
  deleteBudget: (groupId: string, budgetId: string) =>
    request(`/groups/${enc(groupId)}/budgets/${enc(budgetId)}`, { method: 'DELETE' }),

  // Fondos.
  funds: (groupId: string) => request(`/groups/${enc(groupId)}/funds`, { schema: fundListSchema }),
  fund: (groupId: string, fundId: string) =>
    request(`/groups/${enc(groupId)}/funds/${enc(fundId)}`, { schema: fundDetailSchema }),
  createFund: (
    groupId: string,
    input: { name: string; description?: string; memberIds: string[] },
  ) =>
    request(`/groups/${enc(groupId)}/funds`, { method: 'POST', body: input, schema: fundSchema }),
  archiveFund: (groupId: string, fundId: string) =>
    request(`/groups/${enc(groupId)}/funds/${enc(fundId)}/archive`, {
      method: 'POST',
      schema: fundSchema,
    }),
  fundMovements: (groupId: string, fundId: string, cursor?: string) =>
    requestWithMeta(
      `/groups/${enc(groupId)}/funds/${enc(fundId)}/movements${toQuery({ cursor })}`,
      { schema: fundMovementListSchema },
    ),
  createFundMovement: (
    groupId: string,
    fundId: string,
    input: { type: FundMovementType; amountCents: number; description?: string },
    idempotencyKey: string,
  ) =>
    request(`/groups/${enc(groupId)}/funds/${enc(fundId)}/movements`, {
      method: 'POST',
      body: input,
      idempotencyKey,
      schema: createdMovementSchema,
    }),

  // Documentos.
  documents: (filters: { groupId?: string; expenseId?: string; cursor?: string } = {}) =>
    requestWithMeta(`/documents${toQuery(filters)}`, { schema: documentListSchema }),
  uploadDocument: (file: File, links: { groupId?: string; eventId?: string; expenseId?: string }) =>
    request(`/documents${toQuery({ name: file.name, ...links })}`, {
      method: 'POST',
      rawBody: file,
      schema: documentSchema,
    }),
  renameDocument: (documentId: string, name: string) =>
    request(`/documents/${enc(documentId)}`, {
      method: 'PATCH',
      body: { name },
      schema: documentSchema,
    }),
  deleteDocument: (documentId: string) =>
    request(`/documents/${enc(documentId)}`, { method: 'DELETE' }),
  documentDownloadUrl: (documentId: string) =>
    request(`/documents/${enc(documentId)}/download-url`, {
      method: 'POST',
      schema: downloadUrlSchema,
    }),
  documentGrants: (documentId: string) =>
    request(`/documents/${enc(documentId)}/grants`, { schema: documentGrantListSchema }),
  putDocumentGrant: (documentId: string, userId: string, level: DocumentAccess) =>
    request(`/documents/${enc(documentId)}/grants/${enc(userId)}`, {
      method: 'PUT',
      body: { access: level },
      schema: documentGrantSchema,
    }),
  deleteDocumentGrant: (documentId: string, userId: string) =>
    request(`/documents/${enc(documentId)}/grants/${enc(userId)}`, { method: 'DELETE' }),

  // OCR.
  ocrJobs: (documentId?: string) =>
    request(`/ocr/jobs${toQuery({ documentId })}`, { schema: ocrJobListSchema }),
  createOcrJob: (documentId: string) =>
    request('/ocr/jobs', { method: 'POST', body: { documentId }, schema: ocrJobSchema }),
  retryOcrJob: (jobId: string) =>
    request(`/ocr/jobs/${enc(jobId)}/retry`, { method: 'POST', schema: ocrJobSchema }),
  confirmOcrJob: (jobId: string, expenseId: string) =>
    request(`/ocr/jobs/${enc(jobId)}/confirm`, {
      method: 'POST',
      body: { expenseId },
      schema: ocrJobSchema,
    }),

  // Cabudas y estadísticas.
  cabudasSummary: (filters: { groupId?: string; currency?: string } = {}) =>
    request(`/cabudas/summary${toQuery(filters)}`, { schema: cabudasSummarySchema }),
  cabudasHistory: (filters: { status?: string; direction?: string; cursor?: string } = {}) =>
    requestWithMeta(`/cabudas/history${toQuery(filters)}`, { schema: cabudasHistorySchema }),
  statistics: (filters: { from?: string; to?: string; groupId?: string; currency?: string }) =>
    request(`/statistics/summary${toQuery(filters)}`, { schema: statisticsSchema }),
  statisticsExport: (filters: { from?: string; to?: string; groupId?: string; currency?: string }) =>
    requestFile(`/statistics/summary/export${toQuery(filters)}`),

  // Avisos.
  notifications: (status: 'ACTIVE' | 'UNREAD' | 'ARCHIVED' = 'ACTIVE', cursor?: string) =>
    requestWithMeta(`/notifications${toQuery({ status, cursor })}`, {
      schema: notificationListSchema,
    }),
  unreadCount: () => request('/notifications/unread-count', { schema: unreadCountSchema }),
  readNotification: (notificationId: string) =>
    request(`/notifications/${enc(notificationId)}/read`, {
      method: 'POST',
      schema: notificationSchema,
    }),
  archiveNotification: (notificationId: string) =>
    request(`/notifications/${enc(notificationId)}/archive`, {
      method: 'POST',
      schema: notificationSchema,
    }),
  readAllNotifications: () => request('/notifications/read-all', { method: 'POST' }),
  notificationPreferences: () =>
    request('/notifications/preferences', { schema: notificationPreferencesSchema }),
  pushConfig: () => request('/notifications/push-config', { schema: pushConfigSchema }),
  createPushSubscription: (input: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }) => request('/notifications/push-subscriptions', { method: 'POST', body: input }),
  deletePushSubscription: (endpoint: string) =>
    request('/notifications/push-subscriptions', { method: 'DELETE', body: { endpoint } }),
  updateNotificationPreferences: (preferences: NotificationPreferences['preferences']) =>
    request('/notifications/preferences', {
      method: 'PUT',
      body: { preferences },
      schema: notificationPreferencesSchema,
    }),

  // Logros.
  achievements: () => request('/achievements', { schema: achievementListSchema }),

  // Privacidad.
  privacyRequests: () => request('/privacy/requests', { schema: privacyRequestListSchema }),
  createPrivacyRequest: (type: PrivacyRequestType, reason?: string) =>
    request('/privacy/requests', {
      method: 'POST',
      body: reason ? { type, reason } : { type },
      schema: privacyRequestSchema,
    }),
  confirmPrivacyRequest: (requestId: string, password?: string) =>
    request(`/privacy/requests/${enc(requestId)}/confirm`, {
      method: 'POST',
      body: password ? { password } : {},
      schema: privacyRequestSchema,
    }),
  cancelPrivacyRequest: (requestId: string) =>
    request(`/privacy/requests/${enc(requestId)}/cancel`, {
      method: 'POST',
      schema: privacyRequestSchema,
    }),
  privacyExport: (requestId: string) =>
    request<unknown>(`/privacy/requests/${enc(requestId)}/export`),
};
