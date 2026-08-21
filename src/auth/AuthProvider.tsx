import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { cabalesApi } from '../api/cabales-api';
import type { Session } from '../api/contracts';
import { clearCsrfToken, HttpError, onUnauthorized } from '../api/http';
import { queries, queryKeys } from '../api/queries';

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
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery(queries.session());
  useEffect(
    () =>
      onUnauthorized(() => {
        queryClient.setQueryData(queryKeys.session, undefined);
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      }),
    [queryClient],
  );

  const logoutMutation = useMutation({
    mutationFn: cabalesApi.logout,
    onSettled: () => {
      clearCsrfToken();
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
        logout: () => logoutMutation.mutate(),
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
