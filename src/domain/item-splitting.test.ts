import { describe, expect, it } from 'vitest';
import { aggregateItemAllocations, calculateItemAllocations } from './item-splitting';

describe('reparto de items', () => {
  it('distribuye el resto de centavos de forma determinista', () => {
    expect(
      calculateItemAllocations({
        amountCents: 100,
        participantIds: ['a', 'b', 'c'],
        splitMode: 'EQUAL',
      }),
    ).toEqual([
      { eventParticipantId: 'a', amountCents: 34 },
      { eventParticipantId: 'b', amountCents: 33 },
      { eventParticipantId: 'c', amountCents: 33 },
    ]);
  });

  it('valida importes personalizados y agrega la parte por persona', () => {
    const first = calculateItemAllocations({
      amountCents: 500,
      participantIds: ['a', 'b'],
      splitMode: 'EXACT',
      customAmounts: { a: 200, b: 300 },
    });
    const second = calculateItemAllocations({
      amountCents: 300,
      participantIds: ['b', 'c'],
      splitMode: 'EQUAL',
    });
    expect(first).not.toBeNull();
    expect(aggregateItemAllocations([first!, second!])).toEqual(
      new Map([
        ['a', 200],
        ['b', 450],
        ['c', 150],
      ]),
    );
    expect(
      calculateItemAllocations({
        amountCents: 500,
        participantIds: ['a', 'b'],
        splitMode: 'EXACT',
        customAmounts: { a: 200, b: 200 },
      }),
    ).toBeNull();
  });
});
