import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@heroui/react';
import { useAuth } from '../auth/AuthProvider';
import { StatusPanel } from './ui';

/** Niega por defecto el área privada hasta confirmar la sesión con la API. */
export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  // Conserva el fragmento: las invitaciones llevan el token en `#token=`.
  const returnSearch = new URLSearchParams(location.search);
  returnSearch.delete('token');
  const search = returnSearch.toString();
  const returnPath = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`;
  if (auth.isPending)
    return (
      <main className="centered">
        <StatusPanel title="Comprobando sesión">
          <p>Validando tu acceso de forma segura…</p>
        </StatusPanel>
      </main>
    );
  if (auth.session) return <Outlet />;
  if (auth.isUnauthorized) return <Navigate to="/login" replace state={{ from: returnPath }} />;
  if (auth.isError)
    return (
      <main className="centered">
        <StatusPanel
          title={navigator.onLine ? 'No pudimos verificar tu sesión' : 'Estás sin conexión'}
          action={
            <Button variant="primary" type="button" onPress={auth.retry}>
              Reintentar
            </Button>
          }
        >
          <p>
            {navigator.onLine
              ? 'La API no está disponible o respondió de forma inesperada.'
              : 'Por seguridad, Cabales necesita verificar la sesión antes de abrir datos privados.'}
          </p>
        </StatusPanel>
      </main>
    );
  return <Navigate to="/login" replace state={{ from: returnPath }} />;
}
