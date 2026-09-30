import { NavLink } from 'react-router-dom';

/** Navegación contextual entre el resumen, eventos y liquidaciones de un grupo. */
/**
 * Secciones del grupo como navegación (no como tabs ARIA: cada sección es una ruta propia).
 * `aria-current="page"` lo añade NavLink en la sección activa.
 */
export function GroupTabs({ groupId }: { groupId: string }) {
  const base = `/app/groups/${groupId}`;
  const items = [
    { to: base, label: 'Resumen', end: true },
    { to: `${base}/events`, label: 'Eventos' },
    { to: `${base}/settlements`, label: 'Liquidaciones' },
    { to: `${base}/funds`, label: 'Fondos' },
    { to: `${base}/budgets`, label: 'Presupuestos' },
  ];
  return (
    <nav className="tabs" aria-label="Secciones del grupo">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
