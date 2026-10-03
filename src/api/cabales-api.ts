import type {
  AcceptedInvitation,
  CreateEventInput,
  CreateExpenseInput,
  CreateGroupInput,
  CreatedInvitation,
  Event,
  UpdateEventInput,
  Expense,
  ExpenseSummary,
  Group,
  AuthConfig,
  AuthMethods,
  LoginInput,
  PaidTransfer,
  RegisterInput,
  Session,
  SettlementDetail,
  SettlementSummary,
} from './contracts';
import { request } from './http';
import { toQuery } from './modules-api';
import {
  acceptedInvitationSchema,
  createdInvitationSchema,
  createdEventSchema,
  createdGroupSchema,
  eventDetailSchema,
  eventListSchema,
  expenseDetailSchema,
  expenseListSchema,
  groupDetailSchema,
  groupListSchema,
  paidTransferSchema,
  sessionSchema,
  authConfigSchema,
  authMethodsSchema,
  googleLinkStartSchema,
  settlementDetailSchema,
  settlementListSchema,
} from './schemas';

function withCurrentMembership(group: Group, userId: string): Group {
  const membership = group.members?.find((member) => member.user?.id === userId);
  return {
    ...group,
    currentRole: membership?.role,
    currentMemberId: membership?.id,
  };
}

/** Adaptador único del contrato implementado por Cabales API `/api/v1`. */
export const cabalesApi = {
  me: () => request<Session>('/auth/me', { schema: sessionSchema }),
  authConfig: () => request<AuthConfig>('/auth/config', { schema: authConfigSchema }),
  authMethods: () => request<AuthMethods>('/auth/methods', { schema: authMethodsSchema }),
  startGoogleLink: () =>
    request<{ authorizationUrl: string }>('/auth/google/link/start', {
      method: 'POST',
      schema: googleLinkStartSchema,
    }),
  unlinkGoogle: () => request<{ unlinked: true }>('/auth/google', { method: 'DELETE' }),
  login: (input: LoginInput) =>
    request<Session>('/auth/login', { method: 'POST', body: input, schema: sessionSchema }),
  register: (input: RegisterInput) =>
    request<Session>('/auth/register', {
      method: 'POST',
      body: input,
      schema: sessionSchema,
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  groups: () => request<Group[]>('/groups', { schema: groupListSchema }),
  group: async (groupId: string, currentUserId: string) => {
    const group = await request<Group>(`/groups/${encodeURIComponent(groupId)}`, {
      schema: groupDetailSchema,
    });
    return withCurrentMembership(group, currentUserId);
  },
  createGroup: (input: CreateGroupInput) =>
    request<Group>('/groups', { method: 'POST', body: input, schema: createdGroupSchema }),
  createInvitation: (groupId: string, input: { email: string; role: 'ADMIN' | 'MEMBER' }) =>
    request<CreatedInvitation>(`/groups/${encodeURIComponent(groupId)}/invitations`, {
      method: 'POST',
      body: input,
      schema: createdInvitationSchema,
    }),
  acceptInvitation: (token: string) =>
    request<AcceptedInvitation>('/groups/invitations/accept', {
      method: 'POST',
      body: { token },
      schema: acceptedInvitationSchema,
    }),
  events: (groupId: string) =>
    request<Event[]>(`/groups/${encodeURIComponent(groupId)}/events`, {
      schema: eventListSchema,
    }),
  event: (groupId: string, eventId: string) =>
    request<Event>(`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`, {
      schema: eventDetailSchema,
    }),
  createEvent: (groupId: string, input: CreateEventInput) =>
    request<Event>(`/groups/${encodeURIComponent(groupId)}/events`, {
      method: 'POST',
      body: input,
      schema: createdEventSchema,
    }),
  updateEvent: (groupId: string, eventId: string, input: UpdateEventInput) =>
    request<Event>(`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: input,
      schema: eventDetailSchema,
    }),
  cancelEvent: (groupId: string, eventId: string) =>
    request<Event>(
      `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}/cancel`,
      { method: 'POST', schema: eventDetailSchema },
    ),
  deleteEvent: (groupId: string, eventId: string) =>
    request<void>(`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    }),
  rsvpEvent: (
    groupId: string,
    eventId: string,
    status: 'PENDING' | 'GOING' | 'MAYBE' | 'DECLINED',
  ) =>
    request<Event>(
      `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}/rsvp`,
      { method: 'PUT', body: { status }, schema: eventDetailSchema },
    ),
  updateEventReminders: (
    groupId: string,
    eventId: string,
    reminders: Array<{ minutesBefore: number; enabled: boolean }>,
  ) =>
    request<Event>(
      `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}/reminders`,
      { method: 'PUT', body: { reminders }, schema: eventDetailSchema },
    ),
  createExpense: (groupId: string, input: CreateExpenseInput, idempotencyKey: string) =>
    request<Expense>(`/groups/${encodeURIComponent(groupId)}/expenses`, {
      method: 'POST',
      body: input,
      idempotencyKey,
      schema: expenseDetailSchema,
    }),
  expenses: (groupId: string, filters: { from?: string; to?: string; categoryId?: string; tagId?: string; text?: string } = {}) =>
    request<ExpenseSummary[]>(`/groups/${encodeURIComponent(groupId)}/expenses${toQuery(filters)}`, {
      schema: expenseListSchema,
    }),
  expense: (groupId: string, expenseId: string) =>
    request<Expense>(
      `/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}`,
      { schema: expenseDetailSchema },
    ),
  settlements: (groupId: string) =>
    request<SettlementSummary[]>(`/groups/${encodeURIComponent(groupId)}/settlements`, {
      schema: settlementListSchema,
    }),
  settlement: (groupId: string, settlementId: string) =>
    request<SettlementDetail>(
      `/groups/${encodeURIComponent(groupId)}/settlements/${encodeURIComponent(settlementId)}`,
      { schema: settlementDetailSchema },
    ),
  createSettlement: (groupId: string, eventId: string, idempotencyKey: string) =>
    request<SettlementDetail>(`/groups/${encodeURIComponent(groupId)}/settlements`, {
      method: 'POST',
      body: { eventId },
      idempotencyKey,
      schema: settlementDetailSchema,
    }),
  markTransferPaid: (groupId: string, settlementId: string, transferId: string) =>
    request<PaidTransfer>(
      `/groups/${encodeURIComponent(groupId)}/settlements/${encodeURIComponent(settlementId)}/transfers/${encodeURIComponent(transferId)}/paid`,
      { method: 'PATCH', schema: paidTransferSchema },
    ),
};
