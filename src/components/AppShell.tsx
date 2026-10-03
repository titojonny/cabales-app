import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@heroui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { moduleQueries } from '../api/module-queries';
import { modulesApi } from '../api/modules-api';
import { errorText, Icon } from './ui';

type NavItem = {
  to: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  end?: boolean;
  badge?: boolean;
};

/** Móvil: cinco destinos principales; el resto vive en «Más». */
const primaryNavigation: NavItem[] = [
  { to: '/app', label: 'Inicio', icon: 'home', end: true },
  { to: '/app/groups', label: 'Grupos', icon: 'groups' },
  { to: '/app/cabudas', label: 'Cabudas', icon: 'receipt' },
  { to: '/app/notifications', label: 'Avisos', icon: 'bell', badge: true },
  { to: '/app/mas', label: 'Más', icon: 'more' },
];

/** Escritorio: todos los módulos disponibles en el riel lateral. */
const railNavigation: NavItem[] = [
  { to: '/app', label: 'Inicio', icon: 'home', end: true },
  { to: '/app/groups', label: 'Grupos', icon: 'groups' },
  { to: '/app/cabudas', label: 'Cabudas', icon: 'receipt' },
  { to: '/app/docs', label: 'Docs', icon: 'docs' },
  { to: '/app/statistics', label: 'Estadísticas', icon: 'chart' },
  { to: '/app/achievements', label: 'Logros', icon: 'trophy' },
  { to: '/app/notifications', label: 'Avisos', icon: 'bell', badge: true },
  { to: '/app/mas', label: 'Cuenta y privacidad', icon: 'user' },
];

function NavItems({ items, unread }: { items: NavItem[]; unread: number }) {
  return items.map((item) => {
    const showBadge = item.badge && unread > 0;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        aria-label={`${item.label}${showBadge ? `, ${unread} sin leer` : ''}`}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="nav-icon">
          <Icon name={item.icon} />
          {showBadge && (
            <span className="badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        <span>{item.label}</span>
      </NavLink>
    );
  });
}

/** Aviso persistente mientras el correo no esté verificado; permite reenviar el enlace. */
function VerifyEmailBanner({ email }: { email: string }) {
  const resend = useMutation({ mutationFn: () => modulesApi.requestEmailVerification(email) });
  return (
    <div className="verify-banner glass-panel" role="region" aria-label="Verificación de correo">
      <Icon name="shield" />
      <p>
        <strong>Verifica tu correo.</strong>{' '}
        {resend.isSuccess
          ? `Enviamos un nuevo enlace a ${email} si corresponde. Revisa también spam.`
          : resend.isError
            ? errorText(resend.error)
            : `Te enviamos un enlace a ${email} para confirmar que es tuyo.`}
      </p>
      <Button
        variant="tertiary"
        size="sm"
        type="button"
        isDisabled={resend.isPending || resend.isSuccess}
        onPress={() => resend.mutate()}
      >
        {resend.isPending ? 'Enviando…' : 'Reenviar enlace'}
      </Button>
    </div>
  );
}

/** Contiene navegación adaptativa, identidad de sesión y el área de cada módulo. */
export function AppShell() {
  const { session, logout, isLoggingOut } = useAuth();
  const unread = useQuery({ ...moduleQueries.unreadCount(), enabled: Boolean(session) });
  const unreadCount = unread.data?.unread ?? 0;
  return (
    <div className="app-shell">
      <aside className="side-rail glass-panel">
        <NavLink to="/app" className="brand">
          <span className="brand-glyph" aria-hidden="true">
            C
          </span>
          <span>Cabales</span>
        </NavLink>
        <nav aria-label="Navegación principal">
          <NavItems items={railNavigation} unread={unreadCount} />
        </nav>
        <div className="session-card">
          <span className="eyebrow">Sesión</span>
          <strong className="truncate">{session?.user.displayName}</strong>
          <Button
            variant="tertiary"
            type="button"
            className="text-button"
            onPress={logout}
            isDisabled={isLoggingOut}
          >
            {isLoggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </Button>
        </div>
      </aside>
      <main className="app-content" id="contenido">
        {session?.user.emailVerified === false && <VerifyEmailBanner email={session.user.email} />}
        <Outlet />
      </main>
      <nav className="bottom-nav glass-panel" aria-label="Navegación principal móvil">
        <NavItems items={primaryNavigation} unread={unreadCount} />
      </nav>
    </div>
  );
}
