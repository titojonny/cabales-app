import { queryOptions } from '@tanstack/react-query';
import { cabalesApi } from './cabales-api';

/** Claves estables que incluyen todos los identificadores exigidos por la API anidada. */
export const queryKeys = {
  session: ['session'] as const,
  groups: ['groups'] as const,
  group: (groupId: string, userId: string) => ['groups', groupId, 'for', userId] as const,
  events: (groupId: string) => ['groups', groupId, 'events'] as const,
  event: (groupId: string, eventId: string) => ['groups', groupId, 'events', eventId] as const,
  expense: (groupId: string, expenseId: string) =>
    ['groups', groupId, 'expenses', expenseId] as const,
  expenses: (groupId: string) => ['groups', groupId, 'expenses'] as const,
  settlements: (groupId: string) => ['groups', groupId, 'settlements'] as const,
  settlement: (groupId: string, settlementId: string) =>
    ['groups', groupId, 'settlements', settlementId] as const,
};

/** Opciones compartidas para mantener rutas y claves remotas sincronizadas. */
export const queries = {
  session: () =>
    queryOptions({ queryKey: queryKeys.session, queryFn: cabalesApi.me, retry: false }),
  groups: () => queryOptions({ queryKey: queryKeys.groups, queryFn: cabalesApi.groups }),
  group: (groupId: string, userId: string) =>
    queryOptions({
      queryKey: queryKeys.group(groupId, userId),
      queryFn: () => cabalesApi.group(groupId, userId),
    }),
  events: (groupId: string) =>
    queryOptions({
      queryKey: queryKeys.events(groupId),
      queryFn: () => cabalesApi.events(groupId),
    }),
  event: (groupId: string, eventId: string) =>
    queryOptions({
      queryKey: queryKeys.event(groupId, eventId),
      queryFn: () => cabalesApi.event(groupId, eventId),
    }),
  expense: (groupId: string, expenseId: string) =>
    queryOptions({
      queryKey: queryKeys.expense(groupId, expenseId),
      queryFn: () => cabalesApi.expense(groupId, expenseId),
    }),
  expenses: (groupId: string) =>
    queryOptions({
      queryKey: queryKeys.expenses(groupId),
      queryFn: () => cabalesApi.expenses(groupId),
    }),
  settlements: (groupId: string) =>
    queryOptions({
      queryKey: queryKeys.settlements(groupId),
      queryFn: () => cabalesApi.settlements(groupId),
    }),
  settlement: (groupId: string, settlementId: string) =>
    queryOptions({
      queryKey: queryKeys.settlement(groupId, settlementId),
      queryFn: () => cabalesApi.settlement(groupId, settlementId),
    }),
};
