import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from './ui';

const navigation = [
  { to: '/app', label: 'Inicio', icon: 'home' as const, end: true },
  { to: '/app/groups', label: 'Grupos', icon: 'groups' as const },
  { to: '/app/cabudas', label: 'Cabudas', icon: 'receipt' as const },
  { to: '/app/mas', label: 'Más', icon: 'more' as const },
];

/** Contiene navegación adaptativa, identidad de sesión y el área de cada módulo. */
export function AppShell() {
  const { session, logout, isLoggingOut } = useAuth();
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
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="session-card">
          <span className="eyebrow">Sesión</span>
          <strong>{session?.user.displayName}</strong>
          <button type="button" className="text-button" onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
      <main className="app-content" id="contenido">
        <Outlet />
      </main>
      <nav className="bottom-nav glass-panel" aria-label="Navegación principal">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
