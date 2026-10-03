import { Button } from '@heroui/react';
import { startRegistration } from '@simplewebauthn/browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '../api/contracts';
import { clearCsrfToken } from '../api/http';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import type { PrivacyRequest, PrivacyRequestType } from '../api/module-schemas';
import { modulesApi } from '../api/modules-api';
import { queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { ErrorMessage, FieldError, formatDate, Icon } from '../components/ui';
import { normalizeText } from '../domain/validation';
import { PageHeader } from './GroupPages';

const typeLabel: Record<PrivacyRequestType, string> = {
  ACCESS: 'Acceso a mis datos',
  PORTABILITY: 'Portabilidad (exportar)',
  RECTIFICATION: 'Rectificación',
  OBJECTION: 'Oposición',
  ERASURE: 'Eliminar mi cuenta',
};
const typeHelp: Record<PrivacyRequestType, string> = {
  ACCESS: 'Genera una copia de tus datos en formato JSON.',
  PORTABILITY: 'Igual que acceso, pensado para llevar tus datos a otro servicio.',
  RECTIFICATION: 'Pide corregir datos que no puedes editar tú mismo.',
  OBJECTION: 'Oponte a un tratamiento concreto de tus datos.',
  ERASURE:
    'Anonimiza tu cuenta y borra tus credenciales y documentos. Los gastos compartidos se conservan sin tu nombre para no alterar las cuentas de los demás.',
};
const statusLabel: Record<PrivacyRequest['status'], string> = {
  PENDING: 'Pendiente de confirmar',
  IN_PROGRESS: 'En revisión',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

function ProfileSection() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(session?.user.displayName ?? '');
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: (displayName: string) => modulesApi.updateProfile({ displayName }),
    onSuccess: (user) => {
      const current = queryClient.getQueryData<Session>(queryKeys.session);
      if (current) queryClient.setQueryData<Session>(queryKeys.session, { ...current, user });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeText(name);
    if (value.length < 2 || value.length > 120)
      return setError('El nombre debe tener 2 a 120 caracteres.');
    setError(undefined);
    save.mutate(value);
  };
  return (
    <section className="form-card glass-panel">
      <h2>Perfil</h2>
      <p className="muted small">
        {session?.user.email} ·{' '}
        {session?.user.emailVerified === false ? 'correo sin verificar' : 'correo verificado'}
      </p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="profile-name">Nombre visible</label>
        <input
          id="profile-name"
          autoComplete="name"
          value={name}
          aria-describedby="profile-name-error"
          aria-invalid={Boolean(error)}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="profile-name-error" message={error} />
        {save.isError && <ErrorMessage error={save.error} />}
        {save.isSuccess && (
          <p className="success-message" role="status">
            Guardado.
          </p>
        )}
        <Button variant="primary" type="submit" isDisabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </section>
  );
}

function DocumentLockSection() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['documents', 'lock'], queryFn: modulesApi.documentLockStatus, retry: false });
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [ttl, setTtl] = useState('10');
  const browserSupportsWebAuthn =
    typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  const save = useMutation({
    mutationFn: () => modulesApi.configureDocumentLock({ password, ...(pin ? { pin } : {}), unlockTtlMinutes: Number(ttl) }),
    onSuccess: () => { setPassword(''); void queryClient.invalidateQueries({ queryKey: ['documents', 'lock'] }); },
  });
  const remove = useMutation({
    mutationFn: () => modulesApi.removeDocumentLock(password),
    onSuccess: () => { setPassword(''); setPin(''); void queryClient.invalidateQueries({ queryKey: ['documents', 'lock'] }); },
  });
  const register = useMutation({
    mutationFn: async () => {
      const options = await modulesApi.webAuthnRegistrationOptions(password);
      const response = await startRegistration({ optionsJSON: options as never });
      return modulesApi.webAuthnRegistrationVerify(response as unknown as Record<string, unknown>);
    },
    onSuccess: () => { setPassword(''); void queryClient.invalidateQueries({ queryKey: ['documents', 'lock'] }); },
  });
  const error = save.error ?? remove.error ?? register.error;
  return (
    <section className="form-card glass-panel" id="bloqueo-docs" aria-labelledby="document-lock-title">
      <h2 id="document-lock-title">Bloqueo de Docs</h2>
      <p className="muted small">{status.data?.enabled ? 'Activo' : 'Inactivo'} · desbloqueo reciente: {status.data?.unlockTtlMinutes ?? 10} minutos.</p>
      <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} noValidate>
        <label htmlFor="docs-lock-password">Contraseña actual</label>
        <input id="docs-lock-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <label htmlFor="docs-lock-pin">PIN nuevo (6 a 12 dígitos; vacío conserva el PIN actual)</label>
        <input id="docs-lock-pin" inputMode="numeric" minLength={6} maxLength={12} value={pin} onChange={(event) => setPin(event.target.value)} />
        <label htmlFor="docs-lock-ttl">Minutos de desbloqueo</label>
        <input id="docs-lock-ttl" type="number" min={1} max={60} value={ttl} onChange={(event) => setTtl(event.target.value)} />
        <div className="button-row">
          <Button variant="primary" type="submit" isDisabled={save.isPending || !password}>{status.data?.enabled ? 'Guardar cambios' : 'Activar bloqueo'}</Button>
          {status.data?.enabled && <Button variant="danger-soft" type="button" isDisabled={remove.isPending || !password} onPress={() => remove.mutate()}>Quitar bloqueo</Button>}
        </div>
      </form>
      {status.data?.webauthnAvailable && browserSupportsWebAuthn && (
        <Button variant="tertiary" type="button" isDisabled={register.isPending || !password} onPress={() => register.mutate()}>{register.isPending ? 'Esperando passkey…' : 'Añadir passkey o biometría'}</Button>
      )}
      {status.data?.webauthnAvailable && !browserSupportsWebAuthn && (
        <p className="muted small">Este navegador no admite passkeys; puedes proteger Docs con un PIN.</p>
      )}
      {error && <ErrorMessage error={error} />}
    </section>
  );
}

/** Descarga la exportación como archivo JSON generado en el navegador. */
async function downloadExport(request: PrivacyRequest) {
  const data = await modulesApi.privacyExport(request.id);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cabales-mis-datos-${request.createdAt.slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PrivacyRequestRow({ request }: { request: PrivacyRequest }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: moduleKeys.privacyRequests });
  const confirm = useMutation({
    mutationFn: () => modulesApi.confirmPrivacyRequest(request.id, password || undefined),
    onSuccess: (updated) => {
      if (updated.type === 'ERASURE' && updated.status === 'COMPLETED') {
        // La cuenta quedó anonimizada y la API cerró todas las sesiones.
        clearCsrfToken();
        queryClient.clear();
        navigate('/', { replace: true });
        return;
      }
      refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: () => modulesApi.cancelPrivacyRequest(request.id),
    onSuccess: refresh,
  });
  const exportMutation = useMutation({ mutationFn: () => downloadExport(request) });
  const pending = request.status === 'PENDING';
  const error = confirm.error ?? cancel.error ?? exportMutation.error;
  return (
    <li className="glass-panel privacy-row">
      <span className="grow">
        <strong>{typeLabel[request.type]}</strong>
        <small>
          {statusLabel[request.status]} · {formatDate(request.createdAt, true)}
          {request.exportAvailable && request.exportExpiresAt
            ? ` · descarga disponible hasta ${formatDate(request.exportExpiresAt)}`
            : ''}
        </small>
      </span>
      {pending && request.requiresPassword && (
        <div className="erasure-confirm">
          <p className="form-error">
            Esta acción es irreversible: cerrará tus sesiones y anonimizará tu cuenta.
          </p>
          <label htmlFor={`erasure-password-${request.id}`}>Confirma con tu contraseña</label>
          <input
            id={`erasure-password-${request.id}`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      )}
      <span className="row-actions">
        {pending && (
          <Button
            variant={request.requiresPassword ? 'danger' : 'primary'}
            size="sm"
            type="button"
            isDisabled={confirm.isPending || (request.requiresPassword && !password)}
            onPress={() => {
              if (
                !request.requiresPassword ||
                window.confirm('¿Eliminar definitivamente tu cuenta?')
              )
                confirm.mutate();
            }}
          >
            {request.requiresPassword ? 'Eliminar cuenta' : 'Confirmar'}
          </Button>
        )}
        {pending && (
          <Button
            variant="tertiary"
            size="sm"
            type="button"
            isDisabled={cancel.isPending}
            onPress={() => cancel.mutate()}
          >
            Cancelar
          </Button>
        )}
        {request.exportAvailable && (
          <Button
            variant="tertiary"
            size="sm"
            type="button"
            isDisabled={exportMutation.isPending}
            onPress={() => exportMutation.mutate()}
          >
            {exportMutation.isPending ? 'Preparando…' : 'Descargar JSON'}
          </Button>
        )}
      </span>
      {error && <ErrorMessage error={error} />}
    </li>
  );
}

function PrivacySection() {
  const queryClient = useQueryClient();
  const requests = useQuery(moduleQueries.privacyRequests());
  const [type, setType] = useState<PrivacyRequestType>('ACCESS');
  const [reason, setReason] = useState('');
  const create = useMutation({
    mutationFn: () => modulesApi.createPrivacyRequest(type, normalizeText(reason) || undefined),
    onSuccess: () => {
      setReason('');
      void queryClient.invalidateQueries({ queryKey: moduleKeys.privacyRequests });
    },
  });
  return (
    <section className="form-card glass-panel" id="privacidad" aria-labelledby="privacy-title">
      <h2 id="privacy-title">Privacidad y tus datos</h2>
      <p className="muted small">
        Ejerce tus derechos de acceso, rectificación, cancelación, oposición y portabilidad. Más
        detalles en el <Link to="/privacy">aviso de privacidad</Link>.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        noValidate
      >
        <label htmlFor="privacy-type">Solicitud</label>
        <select
          id="privacy-type"
          value={type}
          onChange={(event) => setType(event.target.value as PrivacyRequestType)}
        >
          {Object.entries(typeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="muted small">{typeHelp[type]}</p>
        {(type === 'RECTIFICATION' || type === 'OBJECTION') && (
          <>
            <label htmlFor="privacy-reason">Detalle</label>
            <textarea
              id="privacy-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </>
        )}
        {create.isError && <ErrorMessage error={create.error} />}
        <Button
          variant={type === 'ERASURE' ? 'danger-soft' : 'primary'}
          type="submit"
          isDisabled={create.isPending}
        >
          {create.isPending ? 'Creando…' : 'Crear solicitud'}
        </Button>
      </form>
      {requests.isError && <ErrorMessage error={requests.error} />}
      {requests.data && requests.data.length > 0 && (
        <ul className="privacy-list">
          {requests.data.map((request) => (
            <PrivacyRequestRow key={request.id} request={request} />
          ))}
        </ul>
      )}
    </section>
  );
}

const shortcuts = [
  { to: '/app/docs', label: 'Docs', copy: 'Comprobantes y documentos', icon: 'docs' as const },
  {
    to: '/app/statistics',
    label: 'Estadísticas',
    copy: 'Gasto por categoría y tendencia',
    icon: 'chart' as const,
  },
  {
    to: '/app/achievements',
    label: 'Logros',
    copy: 'Hábitos de cierre y coordinación',
    icon: 'trophy' as const,
  },
  {
    to: '/app/notifications',
    label: 'Avisos',
    copy: 'Invitaciones, pagos y alertas',
    icon: 'bell' as const,
  },
];

/** «Más»: accesos a módulos, perfil, privacidad y cierre de sesión. */
export function AccountPage() {
  const { logout, isLoggingOut } = useAuth();
  return (
    <PageHeader eyebrow="Más" title="Tu cuenta">
      <nav className="shortcut-grid" aria-label="Más módulos">
        {shortcuts.map((item) => (
          <Link key={item.to} to={item.to} className="glass-panel shortcut">
            <Icon name={item.icon} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.copy}</small>
            </span>
          </Link>
        ))}
      </nav>
      <div className="account-grid">
        <ProfileSection />
        <DocumentLockSection />
        <PrivacySection />
      </div>
      <div className="button-row">
        <Button variant="tertiary" type="button" isDisabled={isLoggingOut} onPress={logout}>
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
        <Link className="button quiet" to="/terms">
          Términos de uso
        </Link>
      </div>
    </PageHeader>
  );
}
