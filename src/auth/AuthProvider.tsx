import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { cabalesApi } from '../api/cabales-api';
import type { Session } from '../api/contracts';
import { clearCsrfToken, HttpError, onUnauthorized } from '../api/http';
import { queries, queryKeys } from '../api/queries';
import { clearOfflineQueryCache, startOfflineQueryPersistence } from '../api/offline-cache';

/** Estado público de sesión y acciones disponibles para las rutas y el shell. */
interface AuthState {
  session?: Session;
  isPending: boolean;
  isError: boolean;
  isUnauthorized: boolean;
  retry: () => void;
  logout: () => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

/** Sincroniza la cookie de sesión con Query sin persistir secretos en el navegador. */
/** Provee la sesión remota y centraliza invalidación, logout y recuperación ante 401. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery(queries.session());
  const persistenceCleanup = useRef<(() => void) | undefined>(undefined);
  const persistedUserId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const userId = sessionQuery.data?.user.id;
    const previousUserId = persistedUserId.current;
    if (previousUserId && previousUserId !== userId) {
      persistenceCleanup.current?.();
      persistenceCleanup.current = undefined;
      void clearOfflineQueryCache(previousUserId);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    }
    persistedUserId.current = userId;
    if (!userId) return;
    let active = true;
    void startOfflineQueryPersistence(
      queryClient,
      userId,
      () => active && persistedUserId.current === userId,
    ).then((cleanup) => {
      if (active) persistenceCleanup.current = cleanup;
      else cleanup();
    });
    return () => {
      active = false;
      persistenceCleanup.current?.();
      persistenceCleanup.current = undefined;
    };
  }, [queryClient, sessionQuery.data?.user.id]);
  useEffect(
    () =>
      onUnauthorized(() => {
        persistenceCleanup.current?.();
        persistenceCleanup.current = undefined;
        queryClient.setQueryData(queryKeys.session, undefined);
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
        void clearOfflineQueryCache(sessionQuery.data?.user.id);
      }),
    [queryClient, sessionQuery.data?.user.id],
  );

  const logoutMutation = useMutation({
    mutationFn: cabalesApi.logout,
    onSettled: () => {
      persistenceCleanup.current?.();
      persistenceCleanup.current = undefined;
      clearCsrfToken();
      void clearOfflineQueryCache(sessionQuery.data?.user.id);
      queryClient.clear();
    },
  });

  return (
    <AuthContext.Provider
      value={{
        session: sessionQuery.data,
        isPending: sessionQuery.isPending,
        isError: sessionQuery.isError,
        isUnauthorized:
          sessionQuery.error instanceof HttpError && sessionQuery.error.status === 401,
        retry: () => void sessionQuery.refetch(),
        logout: () => {
          persistenceCleanup.current?.();
          persistenceCleanup.current = undefined;
          void clearOfflineQueryCache(sessionQuery.data?.user.id);
          logoutMutation.mutate();
        },
        isLoggingOut: logoutMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Obtiene el estado de sesión y falla explícitamente fuera de su proveedor. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
