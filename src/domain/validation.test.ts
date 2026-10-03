import { describe, expect, it } from 'vitest';
import { eventSchema, groupSchema, normalizeText } from './validation';

describe('validation', () => {
  it('normaliza Unicode y espacios repetidos', () => {
    expect(normalizeText('  Cafe\u0301   central  ')).toBe('Café central');
  });

  it('rechaza códigos de moneda con formato no canónico', () => {
    expect(groupSchema.safeParse({ name: 'Viaje', description: '', currency: 'US' }).success).toBe(
      false,
    );
  });

  it('rechaza invitados duplicados y enlaces con protocolos no web', () => {
    const base = {
      name: 'Cena',
      description: '',
      startsAt: '2026-08-21T12:00',
      memberIds: [],
      guests: ['Ana', 'ana'],
      links: [],
    };
    expect(eventSchema.safeParse(base).success).toBe(false);
    expect(
      eventSchema.safeParse({
        ...base,
        guests: [],
        links: [{ label: 'Archivo', url: 'file:///tmp/cuenta' }],
      }).success,
    ).toBe(false);
  });
});
