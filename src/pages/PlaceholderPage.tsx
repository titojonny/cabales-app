import { Link } from 'react-router-dom';
import { StatusPanel } from '../components/ui';
import { PageHeader } from './GroupPages';

const modules = {
  cabudas: { title: 'Cabudas', copy: 'Vista consolidada de deudas entre grupos.' },
  docs: { title: 'Docs', copy: 'Comprobantes y documentos asociados a gastos.' },
  statistics: { title: 'Estadísticas', copy: 'Tendencias y resúmenes basados en datos reales.' },
  achievements: { title: 'Logros', copy: 'Reconocimientos por hábitos de cierre y coordinación.' },
  more: { title: 'Más módulos', copy: 'Accesos a las funciones planificadas del producto.' },
};

/** Marca módulos fuera del MVP sin inventar cifras, actividad ni disponibilidad. */
export function PlaceholderPage({ module }: { module: keyof typeof modules }) {
  const item = modules[module];
  return (
    <PageHeader eyebrow="Próximamente · No disponible" title={item.title}>
      <StatusPanel title="Módulo pendiente">
        <p>{item.copy}</p>
        <p>Esta pantalla es un marcador honesto: todavía no consulta ni presenta datos.</p>
      </StatusPanel>
      {module === 'more' && (
        <div className="placeholder-links">
          <Link className="group-card glass-panel" to="/app/docs">
            <strong>Docs</strong>
            <span>Próximamente</span>
          </Link>
          <Link className="group-card glass-panel" to="/app/statistics">
            <strong>Estadísticas</strong>
            <span>Próximamente</span>
          </Link>
          <Link className="group-card glass-panel" to="/app/achievements">
            <strong>Logros</strong>
            <span>Próximamente</span>
          </Link>
        </div>
      )}
    </PageHeader>
  );
}
