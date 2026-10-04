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
  personalExpenseListSchema,
  personalExpenseSchema,
  recurringExpenseListSchema,
  recurringExpenseSchema,
  tagListSchema,
  tagSchema,
  createdMovementSchema,
  documentGrantListSchema,
  documentGrantSchema,
  documentListSchema,
  documentSchema,
  documentLockStatusSchema,
  downloadUrlSchema,
  fundDetailSchema,
  fundListSchema,
  fundMovementListSchema,
  fundSchema,
  incomeListSchema,
  incomeSchema,
  notificationListSchema,
  notificationPreferencesSchema,
  notificationSchema,
  ocrJobListSchema,
  ocrJobSchema,
  pushConfigSchema,
  privacyRequestListSchema,
  privacyRequestSchema,
  sharedLinkListSchema,
  sharedLinkSchema,
  sharedDocumentSchema,
  webAuthnOptionsSchema,
  statisticsSchema,
  unreadCountSchema,
  type DocumentAccess,
  type DocumentLockStatus,
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
export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
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

  // Gastos personales, historial y etiquetas P4.
  personalCategories: () => request('/categories', { schema: categoryListSchema }),
  createPersonalCategory: (input: { name: string; color?: string }) => request('/categories', { method: 'POST', body: input, schema: categorySchema }),
  updatePersonalCategory: (id: string, input: { name?: string; color?: string }) => request(`/categories/${enc(id)}`, { method: 'PATCH', body: input, schema: categorySchema }),
  deletePersonalCategory: (id: string) => request(`/categories/${enc(id)}`, { method: 'DELETE' }),
  personalExpenses: (filters: {
    month?: string;
    from?: string;
    to?: string;
    categoryId?: string;
    tagId?: string;
    groupId?: string;
    text?: string;
    scope?: 'ALL' | 'PERSONAL' | 'GROUPS';
    cursor?: string;
    limit?: number;
  } = {}) => requestWithMeta(`/expenses${toQuery(filters)}`, { schema: personalExpenseListSchema }),
  createPersonalExpense: (
    input: { title: string; notes?: string; categoryId?: string; tagIds: string[]; totalCents: number; currency: string; occurredAt: string },
    idempotencyKey: string,
  ) => request('/expenses', { method: 'POST', body: input, idempotencyKey, schema: personalExpenseSchema }),
  updatePersonalExpense: (expenseId: string, input: Record<string, unknown>) =>
    request(`/expenses/${enc(expenseId)}`, { method: 'PATCH', body: input, schema: personalExpenseSchema }),
  deletePersonalExpense: (expenseId: string) => request(`/expenses/${enc(expenseId)}`, { method: 'DELETE' }),
  personalTags: () => request('/tags', { schema: tagListSchema }),
  createPersonalTag: (name: string) => request('/tags', { method: 'POST', body: { name }, schema: tagSchema }),
  updatePersonalTag: (tagId: string, name: string) => request(`/tags/${enc(tagId)}`, { method: 'PATCH', body: { name }, schema: tagSchema }),
  deletePersonalTag: (tagId: string) => request(`/tags/${enc(tagId)}`, { method: 'DELETE' }),
  groupTags: (groupId: string) => request(`/groups/${enc(groupId)}/tags`, { schema: tagListSchema }),
  createGroupTag: (groupId: string, name: string) => request(`/groups/${enc(groupId)}/tags`, { method: 'POST', body: { name }, schema: tagSchema }),
  updateGroupTag: (groupId: string, tagId: string, name: string) => request(`/groups/${enc(groupId)}/tags/${enc(tagId)}`, { method: 'PATCH', body: { name }, schema: tagSchema }),
  deleteGroupTag: (groupId: string, tagId: string) => request(`/groups/${enc(groupId)}/tags/${enc(tagId)}`, { method: 'DELETE' }),

  // Gastos recurrentes.
  personalRecurring: () => request('/recurring-expenses', { schema: recurringExpenseListSchema }),
  createPersonalRecurring: (input: Record<string, unknown>) => request('/recurring-expenses', { method: 'POST', body: input, schema: recurringExpenseSchema }),
  updatePersonalRecurring: (id: string, input: Record<string, unknown>) => request(`/recurring-expenses/${enc(id)}`, { method: 'PATCH', body: input, schema: recurringExpenseSchema }),
  pausePersonalRecurring: (id: string) => request(`/recurring-expenses/${enc(id)}/pause`, { method: 'POST', schema: recurringExpenseSchema }),
  resumePersonalRecurring: (id: string) => request(`/recurring-expenses/${enc(id)}/resume`, { method: 'POST', schema: recurringExpenseSchema }),
  deletePersonalRecurring: (id: string) => request(`/recurring-expenses/${enc(id)}`, { method: 'DELETE' }),
  groupRecurring: (groupId: string) => request(`/groups/${enc(groupId)}/recurring-expenses`, { schema: recurringExpenseListSchema }),
  createGroupRecurring: (groupId: string, input: Record<string, unknown>) => request(`/groups/${enc(groupId)}/recurring-expenses`, { method: 'POST', body: input, schema: recurringExpenseSchema }),
  pauseGroupRecurring: (groupId: string, id: string) => request(`/groups/${enc(groupId)}/recurring-expenses/${enc(id)}/pause`, { method: 'POST', schema: recurringExpenseSchema }),
  resumeGroupRecurring: (groupId: string, id: string) => request(`/groups/${enc(groupId)}/recurring-expenses/${enc(id)}/resume`, { method: 'POST', schema: recurringExpenseSchema }),
  deleteGroupRecurring: (groupId: string, id: string) => request(`/groups/${enc(groupId)}/recurring-expenses/${enc(id)}`, { method: 'DELETE' }),

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
  updateFund: (groupId: string, fundId: string, input: { name?: string; description?: string | null; contributionPolicy?: 'ANY_MEMBER' | 'MANAGERS' | 'GROUP_ADMINS'; withdrawalPolicy?: 'ANY_MEMBER' | 'MANAGERS' | 'GROUP_ADMINS'; closingPolicy?: 'ANY_MEMBER' | 'MANAGERS' | 'GROUP_ADMINS'; withdrawalLimitCents?: number | null }) =>
    request(`/groups/${enc(groupId)}/funds/${enc(fundId)}`, { method: 'PATCH', body: input, schema: fundSchema }),
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
  documents: (filters: {
    groupId?: string;
    expenseId?: string;
    category?: string;
    pinned?: boolean;
    recent?: boolean;
    cursor?: string;
  } = {}) =>
    requestWithMeta(`/documents${toQuery(filters)}`, { schema: documentListSchema }),
  uploadDocument: (
    file: File,
    links: {
      groupId?: string;
      eventId?: string;
      expenseId?: string;
      category?: string;
      expiresAt?: string;
      expiryNoticeDays?: number[];
    },
  ) => {
    const { expiryNoticeDays, ...rest } = links;
    return request(`/documents${toQuery({ name: file.name, ...rest, ...(expiryNoticeDays ? { expiryNoticeDays: expiryNoticeDays.join(',') } : {}) })}`, {
      method: 'POST',
      rawBody: file,
      schema: documentSchema,
    });
  },
  renameDocument: (documentId: string, name: string) =>
    request(`/documents/${enc(documentId)}`, {
      method: 'PATCH',
      body: { name },
      schema: documentSchema,
    }),
  updateDocument: (documentId: string, input: Record<string, unknown>) =>
    request(`/documents/${enc(documentId)}`, { method: 'PATCH', body: input, schema: documentSchema }),
  deleteDocument: (documentId: string) =>
    request(`/documents/${enc(documentId)}`, { method: 'DELETE' }),
  documentDownloadUrl: (documentId: string) =>
    request(`/documents/${enc(documentId)}/download-url`, {
      method: 'POST',
      schema: downloadUrlSchema,
    }),
  downloadDocument: (documentId: string) =>
    requestFile(`/documents/${enc(documentId)}/download`),
  documentGrants: (documentId: string) =>
    request(`/documents/${enc(documentId)}/grants`, { schema: documentGrantListSchema }),
  putDocumentGrant: (documentId: string, userId: string, level: DocumentAccess, expiresAt?: string | null) =>
    request(`/documents/${enc(documentId)}/grants/${enc(userId)}`, {
      method: 'PUT',
      body: { access: level, ...(expiresAt !== undefined ? { expiresAt } : {}) },
      schema: documentGrantSchema,
    }),
  deleteDocumentGrant: (documentId: string, userId: string) =>
    request(`/documents/${enc(documentId)}/grants/${enc(userId)}`, { method: 'DELETE' }),
  pinDocument: (documentId: string) => request(`/documents/${enc(documentId)}/pin`, { method: 'POST' }),
  unpinDocument: (documentId: string) => request(`/documents/${enc(documentId)}/pin`, { method: 'DELETE' }),
  documentSharedLinks: (documentId: string) =>
    request(`/documents/${enc(documentId)}/shared-links`, { schema: sharedLinkListSchema }),
  createDocumentSharedLink: (documentId: string, input: { expiresAt: string; maxAccesses?: number }) =>
    request(`/documents/${enc(documentId)}/shared-links`, { method: 'POST', body: input, schema: sharedLinkSchema }),
  revokeDocumentSharedLink: (documentId: string, linkId: string) =>
    request(`/documents/${enc(documentId)}/shared-links/${enc(linkId)}/revoke`, { method: 'POST' }),
  documentLockStatus: () => request<DocumentLockStatus>('/documents/lock/status', { schema: documentLockStatusSchema }),
  configureDocumentLock: (input: { password: string; pin?: string | null; unlockTtlMinutes?: number }) =>
    request('/documents/lock', { method: 'PUT', body: input }),
  removeDocumentLock: (password: string) => request('/documents/lock', { method: 'DELETE', body: { password } }),
  unlockDocumentsWithPin: (pin: string) => request('/documents/lock/pin', { method: 'POST', body: { pin }, schema: documentLockStatusSchema }),
  webAuthnRegistrationOptions: (password: string) =>
    request('/documents/lock/webauthn/registration-options', { method: 'POST', body: { password }, schema: webAuthnOptionsSchema }),
  webAuthnRegistrationVerify: (response: Record<string, unknown>) =>
    request('/documents/lock/webauthn/registration-verify', { method: 'POST', body: response }),
  webAuthnAuthenticationOptions: () =>
    request('/documents/lock/webauthn/authentication-options', { method: 'POST', schema: webAuthnOptionsSchema }),
  webAuthnAuthenticationVerify: (response: Record<string, unknown>) =>
    request('/documents/lock/webauthn/authentication-verify', { method: 'POST', body: response, schema: documentLockStatusSchema }),
  sharedDocument: (token: string) => request(`/share/documents/${enc(token)}`, { schema: sharedDocumentSchema }),
  downloadSharedDocument: (token: string) => requestFile(`/share/documents/${enc(token)}/download`),

  // OCR.
  ocrJobs: (documentId?: string) =>
    request(`/ocr/jobs${toQuery({ documentId })}`, { schema: ocrJobListSchema }),
  ocrJob: (jobId: string) => request(`/ocr/jobs/${enc(jobId)}`, { schema: ocrJobSchema }),
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
  statisticsExport: (filters: {
    from?: string;
    to?: string;
    groupId?: string;
    currency?: string;
  }) => requestFile(`/statistics/summary/export${toQuery(filters)}`),
  statisticsPdfExport: (filters: {
    from?: string;
    to?: string;
    groupId?: string;
    currency?: string;
  }) => requestFile(`/statistics/summary/export/pdf${toQuery(filters)}`),
  incomes: (filters: { from?: string; to?: string; currency?: string } = {}) =>
    request(`/incomes${toQuery(filters)}`, { schema: incomeListSchema }),
  createIncome: (input: {
    amountCents: number;
    date: string;
    category: string;
    note?: string | null;
    currency: string;
  }) => request('/incomes', { method: 'POST', body: input, schema: incomeSchema }),
  updateIncome: (
    incomeId: string,
    input: Partial<{
      amountCents: number;
      date: string;
      category: string;
      note: string | null;
      currency: string;
    }>,
  ) => request(`/incomes/${enc(incomeId)}`, { method: 'PATCH', body: input, schema: incomeSchema }),
  deleteIncome: (incomeId: string) => request(`/incomes/${enc(incomeId)}`, { method: 'DELETE' }),

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
  createPushSubscription: (input: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request('/notifications/push-subscriptions', { method: 'POST', body: input }),
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
