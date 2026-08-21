import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { StatusPanel } from './ui';

/** Niega por defecto el área privada hasta confirmar la sesión con la API. */
export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;
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
            <button className="button primary" type="button" onClick={auth.retry}>
              Reintentar
            </button>
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
