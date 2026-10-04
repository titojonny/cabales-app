import { QueryClient, dehydrate } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { hydrateOfflineCacheIfCurrent, isOfflinePersistableQueryKey } from './offline-cache';

describe('allowlist de caché offline', () => {
  it('solo acepta consultas de lectura no privadas de P7', () => {
    expect(isOfflinePersistableQueryKey(['statistics', { currency: 'USD' }])).toBe(true);
    expect(isOfflinePersistableQueryKey(['incomes', { month: '2026-10' }])).toBe(true);
    expect(isOfflinePersistableQueryKey(['session'])).toBe(false);
    expect(isOfflinePersistableQueryKey(['documents'])).toBe(false);
    expect(isOfflinePersistableQueryKey(['privacy'])).toBe(false);
    expect(isOfflinePersistableQueryKey(['ocr', 'all'])).toBe(false);
  });

  it('no hidrata la cachÃ© de una sesiÃ³n cuando cambia el usuario durante la lectura', () => {
    const source = new QueryClient();
    source.setQueryData(['groups'], { name: 'grupo privado anterior' });
    const target = new QueryClient();
    const hydrated = hydrateOfflineCacheIfCurrent(
      target,
      { version: 1, userId: 'usuario-anterior', savedAt: Date.now(), cache: dehydrate(source) },
      () => false,
    );

    expect(hydrated).toBe(false);
    expect(target.getQueryData(['groups'])).toBeUndefined();
  });
});
