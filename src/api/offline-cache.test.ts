import { describe, expect, it } from 'vitest';
import { isOfflinePersistableQueryKey } from './offline-cache';

describe('allowlist de caché offline', () => {
  it('solo acepta consultas de lectura no privadas de P7', () => {
    expect(isOfflinePersistableQueryKey(['statistics', { currency: 'USD' }])).toBe(true);
    expect(isOfflinePersistableQueryKey(['incomes', { month: '2026-10' }])).toBe(true);
    expect(isOfflinePersistableQueryKey(['session'])).toBe(false);
    expect(isOfflinePersistableQueryKey(['documents'])).toBe(false);
    expect(isOfflinePersistableQueryKey(['privacy'])).toBe(false);
    expect(isOfflinePersistableQueryKey(['ocr', 'all'])).toBe(false);
  });
});
