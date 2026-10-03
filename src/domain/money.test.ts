import { describe, expect, it } from 'vitest';
import { isExactSplitValid, MAX_MONEY_CENTS, parseMoneyToCents, splitEqual } from './money';

describe('money', () => {
  it('conserva todos los centavos al repartir en partes iguales', () => {
    const result = splitEqual(1000, ['a', 'b', 'c']);
    expect(result).toEqual([
      { memberId: 'a', amountMinor: 334 },
      { memberId: 'b', amountMinor: 333 },
      { memberId: 'c', amountMinor: 333 },
    ]);
  });

  it('valida la suma exacta y convierte coma decimal sin truncar', () => {
    expect(parseMoneyToCents('12,50')).toBe(1250);
    expect(parseMoneyToCents('12.345')).toBeNull();
    expect(isExactSplitValid(1250, [500, 750])).toBe(true);
    expect(isExactSplitValid(1250, [500, 749])).toBe(false);
  });

  it('acepta el límite Int exacto y rechaza el centavo siguiente', () => {
    expect(parseMoneyToCents('21474836.47')).toBe(MAX_MONEY_CENTS);
    expect(parseMoneyToCents('21474836.48')).toBeNull();
    expect(parseMoneyToCents('999999999999999999999.99')).toBeNull();
  });
});
