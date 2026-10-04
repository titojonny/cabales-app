import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import {
  ArrowRightLeft,
  Bell,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronRight,
  FileText,
  House,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  ShieldCheck,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import { HttpError } from '../api/http';

/** Nombres semánticos permitidos para los iconos usados por la navegación y las acciones. */
type IconName =
  | 'home'
  | 'groups'
  | 'plus'
  | 'receipt'
  | 'transfer'
  | 'more'
  | 'arrow'
  | 'check'
  | 'bell'
  | 'docs'
  | 'chart'
  | 'trophy'
  | 'fund'
  | 'budget'
  | 'shield'
  | 'user'
  | 'calendar';

const icons: Record<IconName, LucideIcon> = {
  home: House,
  groups: UsersRound,
  plus: Plus,
  receipt: Receipt,
  transfer: ArrowRightLeft,
  more: MoreHorizontal,
  arrow: ChevronRight,
  check: Check,
  bell: Bell,
  docs: FileText,
  chart: ChartColumn,
  trophy: Trophy,
  fund: PiggyBank,
  budget: Target,
  shield: ShieldCheck,
  user: UserRound,
  calendar: CalendarDays,
};

/** Renderiza iconos Lucide consistentes; el texto contiguo conserva el nombre accesible. */
export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const LucideComponent = icons[name];
  return <LucideComponent aria-hidden="true" focusable="false" strokeWidth={1.8} {...props} />;
}

/** Estado reutilizable para carga, vacío, error u orientación contextual. */
export function StatusPanel({
  title,
  children,
  action,
}: {
  /** Título que identifica el estado al usuario y a tecnologías asistivas. */
  title: string;
  /** Explicación contextual del estado actual. */
  children: ReactNode;
  /** Acción opcional disponible para recuperar o continuar el flujo. */
  action?: ReactNode;
}) {
  return (
    <section className="status-panel" role="status">
      <span className="status-mark" aria-hidden="true" />
      <h2>{title}</h2>
      <div className="status-copy">{children}</div>
      {action}
    </section>
  );
}

/** Texto seguro para un error: solo mensajes controlados de la API o de la interfaz. */
export function errorText(error: unknown): string {
  if (error instanceof HttpError && error.status === 429)
    return 'Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo.';
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

/**
 * Muestra el error junto al formulario o sección que lo produjo. Permanece visible (un toast
 * desaparecía antes de poder leerlo) y `role="alert"` lo anuncia a lectores de pantalla.
 */
export function ErrorMessage({ error }: { error: unknown }) {
  return (
    <p className="form-error" role="alert">
      {errorText(error)}
    </p>
  );
}

/** Error de validación visible bajo el control y enlazado mediante `aria-describedby`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="form-field-error" role="alert">
      {message}
    </span>
  ) : null;
}

/** Estado de carga consistente para secciones remotas. */
export function LoadingState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <StatusPanel title={title}>
      <p aria-busy="true">{children ?? 'Consultando datos…'}</p>
    </StatusPanel>
  );
}

/** Estado de error con reintento opcional. */
export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <StatusPanel
      title={title}
      action={
        onRetry ? (
          <Button variant="tertiary" type="button" onPress={onRetry}>
            Reintentar
          </Button>
        ) : undefined
      }
    >
      <ErrorMessage error={error} />
    </StatusPanel>
  );
}

/** Barra de progreso accesible; el color refleja el estado de alerta. */
export function ProgressBar({
  value,
  label,
  tone = 'ok',
}: {
  value: number;
  label: string;
  tone?: 'ok' | 'warning' | 'danger';
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`progress progress-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Fecha legible en español; acepta ISO de la API. */
export function formatDate(value: string, withTime = false): string {
  const date = new Date(value);
  return withTime
    ? date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString('es', { dateStyle: 'medium' });
}

/** Tamaño de archivo legible. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
