import { describe, expect, it } from 'vitest';
import {
  parsePercentageToBps,
  roundPercentageCents,
  splitPercentage,
  splitProportional,
} from './money';

describe('reparto porcentual del cliente', () => {
  it('convierte porcentajes visibles a puntos básicos y valida la suma', () => {
    expect(parsePercentageToBps('33,33')).toBe(3333);
    expect(parsePercentageToBps('100.01')).toBeNull();
    expect(splitPercentage(100, [3333, 3333, 3334])).toEqual([33, 33, 34]);
  });

  it('calcula redondeo y restos mayores para cargos', () => {
    expect(roundPercentageCents(101, 500)).toBe(5);
    expect(splitProportional(5, [1, 2])).toEqual([2, 3]);
    expect(
      splitProportional(
        200,
        Array.from({ length: 200 }, () => 1),
      ),
    ).toEqual(Array.from({ length: 200 }, () => 1));
  });
});
