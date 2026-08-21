import type { ReactNode, SVGProps } from 'react';

type IconName = 'home' | 'groups' | 'plus' | 'receipt' | 'transfer' | 'more' | 'arrow' | 'check';

const paths: Record<IconName, ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6" />,
  groups: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20M14 14h2.5a4 4 0 0 1 4 4v2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  transfer: <path d="m7 7-4 4 4 4M3 11h15M17 17l4-4-4-4M21 13H6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
};

/** Renderiza símbolos vectoriales consistentes; el texto contiguo conserva el nombre accesible. */
export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
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
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}

/** Asocia un error de validación al control mediante un identificador estable. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="field-error">
      {message}
    </p>
  ) : null;
}
