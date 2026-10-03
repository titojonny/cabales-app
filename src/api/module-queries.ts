import { queryOptions } from '@tanstack/react-query';
import { modulesApi } from './modules-api';

/** Claves de los módulos; las de grupo comparten prefijo para invalidar en bloque. */
export const moduleKeys = {
  invitations: (groupId: string) => ['groups', groupId, 'invitations'] as const,
  categories: (groupId: string) => ['groups', groupId, 'categories'] as const,
  budgets: (groupId: string) => ['groups', groupId, 'budgets'] as const,
  budget: (groupId: string, budgetId: string) => ['groups', groupId, 'budgets', budgetId] as const,
  funds: (groupId: string) => ['groups', groupId, 'funds'] as const,
  fund: (groupId: string, fundId: string) => ['groups', groupId, 'funds', fundId] as const,
  fundMovements: (groupId: string, fundId: string) =>
    ['groups', groupId, 'funds', fundId, 'movements'] as const,
  documents: (filters: Record<string, string | undefined>) => ['documents', filters] as const,
  documentsRoot: ['documents'] as const,
  documentGrants: (documentId: string) => ['documents', 'grants', documentId] as const,
  ocrJobs: (documentId?: string) => ['ocr', documentId ?? 'all'] as const,
  ocrJob: (jobId: string) => ['ocr', 'job', jobId] as const,
  ocrRoot: ['ocr'] as const,
  cabudas: ['cabudas'] as const,
  cabudasHistory: (status: string) => ['cabudas', 'history', status] as const,
  statistics: (filters: Record<string, string | undefined>) => ['statistics', filters] as const,
  incomes: (filters: Record<string, string | undefined>) => ['incomes', filters] as const,
  notifications: (status: string) => ['notifications', status] as const,
  notificationsRoot: ['notifications'] as const,
  unreadCount: ['notifications', 'unread'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,
  pushConfig: ['notifications', 'push-config'] as const,
  achievements: ['achievements'] as const,
  privacyRequests: ['privacy'] as const,
  personalExpenses: (filters: Record<string, string | number | undefined>) => ['expenses', filters] as const,
  personalTags: ['tags', 'personal'] as const,
  personalCategories: ['categories', 'personal'] as const,
  personalRecurring: ['recurring-expenses', 'personal'] as const,
  groupTags: (groupId: string) => ['groups', groupId, 'tags'] as const,
};

export const moduleQueries = {
  invitations: (groupId: string) =>
    queryOptions({
      queryKey: moduleKeys.invitations(groupId),
      queryFn: () => modulesApi.invitations(groupId),
    }),
  categories: (groupId: string) =>
    queryOptions({
      queryKey: moduleKeys.categories(groupId),
      queryFn: () => modulesApi.categories(groupId),
    }),
  budgets: (groupId: string) =>
    queryOptions({
      queryKey: moduleKeys.budgets(groupId),
      queryFn: () => modulesApi.budgets(groupId),
    }),
  funds: (groupId: string) =>
    queryOptions({ queryKey: moduleKeys.funds(groupId), queryFn: () => modulesApi.funds(groupId) }),
  fund: (groupId: string, fundId: string) =>
    queryOptions({
      queryKey: moduleKeys.fund(groupId, fundId),
      queryFn: () => modulesApi.fund(groupId, fundId),
    }),
  cabudas: () =>
    queryOptions({ queryKey: moduleKeys.cabudas, queryFn: () => modulesApi.cabudasSummary() }),
  unreadCount: () =>
    queryOptions({
      queryKey: moduleKeys.unreadCount,
      queryFn: modulesApi.unreadCount,
      // Contador ligero: se refresca en segundo plano mientras la app está abierta.
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
    }),
  notificationPreferences: () =>
    queryOptions({
      queryKey: moduleKeys.notificationPreferences,
      queryFn: modulesApi.notificationPreferences,
    }),
  pushConfig: () =>
    queryOptions({ queryKey: moduleKeys.pushConfig, queryFn: modulesApi.pushConfig }),
  achievements: () =>
    queryOptions({ queryKey: moduleKeys.achievements, queryFn: modulesApi.achievements }),
  incomes: (filters: { from?: string; to?: string; currency?: string } = {}) =>
    queryOptions({
      queryKey: moduleKeys.incomes(filters),
      queryFn: () => modulesApi.incomes(filters),
    }),
  privacyRequests: () =>
    queryOptions({ queryKey: moduleKeys.privacyRequests, queryFn: modulesApi.privacyRequests }),
  personalExpenses: (filters: Record<string, string | number | undefined> = {}) =>
    queryOptions({ queryKey: moduleKeys.personalExpenses(filters), queryFn: () => modulesApi.personalExpenses(filters) }),
  personalTags: () => queryOptions({ queryKey: moduleKeys.personalTags, queryFn: modulesApi.personalTags }),
  personalCategories: () => queryOptions({ queryKey: moduleKeys.personalCategories, queryFn: modulesApi.personalCategories }),
  personalRecurring: () => queryOptions({ queryKey: moduleKeys.personalRecurring, queryFn: modulesApi.personalRecurring }),
  groupTags: (groupId: string) => queryOptions({ queryKey: moduleKeys.groupTags(groupId), queryFn: () => modulesApi.groupTags(groupId) }),
};
