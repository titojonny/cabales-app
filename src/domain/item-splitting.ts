import { splitEqual } from './money';

export type ItemSplitMode = 'EQUAL' | 'EXACT';

export interface ItemSplitInput {
  amountCents: number;
  participantIds: string[];
  splitMode: ItemSplitMode;
  customAmounts?: Record<string, number>;
}

/** Calcula asignaciones exactas; EQUAL conserva cada centavo con restos mayores. */
export function calculateItemAllocations(input: ItemSplitInput): Array<{
  eventParticipantId: string;
  amountCents: number;
}> | null {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return null;
  const ids = [...new Set(input.participantIds)];
  if (ids.length === 0) return null;
  if (input.splitMode === 'EQUAL')
    return splitEqual(input.amountCents, ids).map(({ memberId, amountMinor }) => ({
      eventParticipantId: memberId,
      amountCents: amountMinor,
    }));
  const allocations = ids.map((eventParticipantId) => ({
    eventParticipantId,
    amountCents: input.customAmounts?.[eventParticipantId] ?? 0,
  }));
  return allocations.every(({ amountCents }) => amountCents > 0) &&
    allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0) === input.amountCents
    ? allocations
    : null;
}

/** Agrega las asignaciones de los items para formar las partes EXACT del gasto. */
export function aggregateItemAllocations(
  allocations: Array<Array<{ eventParticipantId: string; amountCents: number }>>,
) {
  const result = new Map<string, number>();
  for (const item of allocations)
    for (const allocation of item)
      result.set(
        allocation.eventParticipantId,
        (result.get(allocation.eventParticipantId) ?? 0) + allocation.amountCents,
      );
  return result;
}
