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
  ocrRoot: ['ocr'] as const,
  cabudas: ['cabudas'] as const,
  cabudasHistory: (status: string) => ['cabudas', 'history', status] as const,
  statistics: (filters: Record<string, string | undefined>) => ['statistics', filters] as const,
  notifications: (status: string) => ['notifications', status] as const,
  notificationsRoot: ['notifications'] as const,
  unreadCount: ['notifications', 'unread'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,
  pushConfig: ['notifications', 'push-config'] as const,
  achievements: ['achievements'] as const,
  privacyRequests: ['privacy'] as const,
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
  privacyRequests: () =>
    queryOptions({ queryKey: moduleKeys.privacyRequests, queryFn: modulesApi.privacyRequests }),
};
