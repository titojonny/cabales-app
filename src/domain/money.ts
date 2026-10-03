/** Máximo monetario representable por Prisma/PostgreSQL `Int`. */
export const MAX_MONEY_CENTS = 2_147_483_647;
export const BASIS_POINTS_TOTAL = 10_000;

/** Convierte solo decimales canónicos positivos y representables, sin truncar precisión. */
export function parseMoneyToCents(value: string): number | null {
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ''] = value.replace(',', '.').split('.');
  const cents = BigInt(whole || '0') * 100n + BigInt(decimal.padEnd(2, '0'));
  if (cents <= 0n || cents > BigInt(MAX_MONEY_CENTS)) return null;
  return Number(cents);
}

/** Formatea unidades menores con la moneda validada por el formulario o la API. */
export function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/** Distribuye centavos sobrantes en orden para conservar exactamente el total. */
export function splitEqual(
  totalMinor: number,
  memberIds: string[],
): Array<{ memberId: string; amountMinor: number }> {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0 || memberIds.length === 0) return [];
  const base = Math.floor(totalMinor / memberIds.length);
  const remainder = totalMinor % memberIds.length;
  return memberIds.map((memberId, index) => ({
    memberId,
    amountMinor: base + (index < remainder ? 1 : 0),
  }));
}

/** Comprueba que un reparto exacto use enteros no negativos y conserve el total. */
export function isExactSplitValid(totalMinor: number, amountsMinor: number[]): boolean {
  return (
    amountsMinor.every((amount) => Number.isSafeInteger(amount) && amount >= 0) &&
    amountsMinor.reduce((sum, amount) => sum + amount, 0) === totalMinor
  );
}

/** Convierte un porcentaje humano con hasta dos decimales a puntos básicos. */
export function parsePercentageToBps(value: string): number | null {
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(value)) return null;
  const normalized = value.replace(',', '.');
  const [whole, decimal = ''] = normalized.split('.');
  const bps = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
  return bps <= BigInt(BASIS_POINTS_TOTAL) ? Number(bps) : null;
}

/** Redondeo mitad hacia arriba del porcentaje de un subtotal. */
export function roundPercentageCents(subtotalCents: number, percentageBps: number): number {
  return Math.floor((subtotalCents * percentageBps + BASIS_POINTS_TOTAL / 2) / BASIS_POINTS_TOTAL);
}

/** Distribuye un subtotal según puntos básicos; el orden rompe empates de restos. */
export function splitPercentage(subtotalCents: number, percentagesBps: number[]): number[] {
  if (
    percentagesBps.length === 0 ||
    percentagesBps.reduce((sum, value) => sum + value, 0) !== BASIS_POINTS_TOTAL
  )
    return [];
  const floors = percentagesBps.map((percentage) =>
    Math.floor((subtotalCents * percentage) / BASIS_POINTS_TOTAL),
  );
  const remainders = percentagesBps.map(
    (percentage) => (subtotalCents * percentage) % BASIS_POINTS_TOTAL,
  );
  const remaining = subtotalCents - floors.reduce((sum, value) => sum + value, 0);
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index += 1)
    floors[order[index % order.length]!.index]! += 1;
  return floors;
}

/** Distribuye un cargo por la parte de subtotal de cada persona. */
export function splitProportional(chargeCents: number, subtotalShares: number[]): number[] {
  const subtotal = subtotalShares.reduce((sum, value) => sum + value, 0);
  if (subtotal <= 0 || subtotalShares.length === 0) return [];
  const floors = subtotalShares.map((share) => Math.floor((chargeCents * share) / subtotal));
  const remainders = subtotalShares.map((share) => (chargeCents * share) % subtotal);
  const remaining = chargeCents - floors.reduce((sum, value) => sum + value, 0);
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index += 1)
    floors[order[index % order.length]!.index]! += 1;
  return floors;
}
