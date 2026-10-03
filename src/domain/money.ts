/** Máximo monetario representable por Prisma/PostgreSQL `Int`. */
export const MAX_MONEY_CENTS = 2_147_483_647;

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
