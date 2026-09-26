import type { ReactNode } from 'react';
import { Toast } from '@heroui/react';
import { useEffect } from 'react';
import {
  ArrowRightLeft,
  Check,
  ChevronRight,
  House,
  MoreHorizontal,
  Plus,
  Receipt,
  UsersRound,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

type IconName = 'home' | 'groups' | 'plus' | 'receipt' | 'transfer' | 'more' | 'arrow' | 'check';

const icons: Record<IconName, LucideIcon> = {
  home: House,
  groups: UsersRound,
  plus: Plus,
  receipt: Receipt,
  transfer: ArrowRightLeft,
  more: MoreHorizontal,
  arrow: ChevronRight,
  check: Check,
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
  title: string;
  children: ReactNode;
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

/** Presenta el mensaje seguro de un error desconocido sin filtrar detalles internos. */
export function ErrorMessage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  useEffect(() => {
    const toastId = Toast.toast.danger(message, { timeout: 6000 });
    return () => Toast.toast.close(toastId);
  }, [message]);
  return null;
}

/** Asocia un error de validación al control mediante un identificador estable. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  useEffect(() => {
    if (!message) return undefined;
    const toastId = Toast.toast.danger(message, { timeout: 5000 });
    return () => Toast.toast.close(toastId);
  }, [message]);
  return message ? (
    <span id={id} className="sr-only">
      {message}
    </span>
  ) : null;
}
