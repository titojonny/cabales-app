import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const DATABASE_NAME = 'cabales-offline-cache';
const STORE_NAME = 'query-caches';
const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;
const allowedRoots = new Set(['groups', 'cabudas', 'statistics', 'incomes', 'achievements']);

type PersistedCache = {
  version: number;
  userId: string;
  savedAt: number;
  cache: unknown;
};

type OfflineStatus = { lastUpdatedAt?: number; hydrated: boolean };
let status: OfflineStatus = { hydrated: false };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setStatus(next: OfflineStatus) {
  status = next;
  notify();
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase | undefined> {
  if (!canUseIndexedDb()) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'userId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}

function readCache(userId: string): Promise<PersistedCache | undefined> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve) => {
        if (!database) return resolve(undefined);
        const request = database
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .get(userId);
        request.onsuccess = () => resolve(request.result as PersistedCache | undefined);
        request.onerror = () => resolve(undefined);
      }),
  );
}

async function writeCache(
  value: PersistedCache,
  isActive: () => boolean = () => true,
): Promise<void> {
  if (!isActive()) return;
  const database = await openDatabase();
  if (!database || !isActive()) return;
  await new Promise<void>((resolve) => {
    const request = database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
  if (isActive()) setStatus({ hydrated: true, lastUpdatedAt: value.savedAt });
}

export async function clearOfflineQueryCache(userId?: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    if (userId) store.delete(userId);
    else store.clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
  setStatus({ hydrated: false });
}

export function isOfflinePersistableQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === 'string' && allowedRoots.has(root);
}

/** Hidrata solo si la sesiÃ³n que iniciÃ³ la lectura sigue siendo la vigente. */
export function hydrateOfflineCacheIfCurrent(
  queryClient: QueryClient,
  stored: PersistedCache,
  isActive: () => boolean,
  now = Date.now(),
): boolean {
  if (!isActive() || stored.version !== VERSION || now - stored.savedAt > MAX_AGE_MS) return false;
  hydrate(queryClient, stored.cache);
  setStatus({ hydrated: true, lastUpdatedAt: stored.savedAt });
  return true;
}

/**
 * Persiste únicamente respuestas de lectura de una allowlist sin documentos, privacidad,
 * sesión ni tokens. El límite de 2 MiB y la caducidad de 7 días son la defensa adicional;
 * el registro está separado por usuario y se borra al cerrar/cambiar sesión.
 */
export async function startOfflineQueryPersistence(
  queryClient: QueryClient,
  userId: string,
  isActive: () => boolean = () => true,
): Promise<() => void> {
  if (!canUseIndexedDb()) return () => undefined;
  const stored = await readCache(userId);
  if (stored && !hydrateOfflineCacheIfCurrent(queryClient, stored, isActive)) {
    if (!isActive()) return () => undefined;
    await clearOfflineQueryCache(userId);
  }
  if (!isActive()) return () => undefined;
  let timer: number | undefined;
  const save = () => {
    if (!isActive()) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!isActive()) return;
      const cache = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          isOfflinePersistableQueryKey(query.queryKey) && query.state.status === 'success',
      });
      let serialized: string;
      try {
        serialized = JSON.stringify(cache);
      } catch {
        return;
      }
      if (serialized.length > MAX_BYTES) return;
      void writeCache({ version: VERSION, userId, savedAt: Date.now(), cache }, isActive);
    }, 250);
  };
  const unsubscribe = queryClient.getQueryCache().subscribe(save);
  save();
  return () => {
    if (timer !== undefined) window.clearTimeout(timer);
    unsubscribe();
  };
}

export function useOfflineCacheStatus(): OfflineStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => status,
  );
}
