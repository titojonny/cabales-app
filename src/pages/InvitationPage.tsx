import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { queryKeys } from '../api/queries';
import { ErrorMessage, FieldError, StatusPanel } from '../components/ui';
import {
  acceptInvitationSchema,
  invitationSchema,
  type AcceptInvitationValues,
  type InvitationValues,
} from '../domain/validation';

/** Crea invitaciones RBAC y presenta el token porque el MVP no envía correo. */
export function GroupInvitationForm({ groupId }: { groupId: string }) {
  const form = useForm<InvitationValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });
  const mutation = useMutation({
    mutationFn: (values: InvitationValues) => cabalesApi.createInvitation(groupId, values),
  });
  const invitationUrl = mutation.data
    ? `${window.location.origin}/app/invitations/accept?token=${encodeURIComponent(mutation.data.token)}`
    : '';

  return (
    <section className="form-card glass-panel invitation-card">
      <h2>Invitar persona</h2>
      <p className="muted">Solo OWNER o ADMIN. La API vuelve a validar el permiso.</p>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <label htmlFor="invite-email">Correo</label>
        <input
          id="invite-email"
          type="email"
          autoComplete="email"
          aria-describedby="invite-email-error"
          {...form.register('email')}
        />
        <FieldError id="invite-email-error" message={form.formState.errors.email?.message} />
        <label htmlFor="invite-role">Rol</label>
        <select id="invite-role" {...form.register('role')}>
          <option value="MEMBER">Miembro</option>
          <option value="ADMIN">Administrador</option>
        </select>
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <button className="button primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Crear invitación'}
        </button>
      </form>
      {mutation.data && (
        <div className="invitation-result" role="status">
          <strong>Invitación creada, sin envío de correo</strong>
          <p>Comparte este enlace únicamente con {mutation.data.invitation.email}.</p>
          <input aria-label="Enlace de invitación" readOnly value={invitationUrl} />
          <button
            className="button quiet"
            type="button"
            onClick={() => void navigator.clipboard?.writeText(invitationUrl)}
          >
            Copiar enlace
          </button>
          <small>Expira: {new Date(mutation.data.invitation.expiresAt).toLocaleString('es')}</small>
        </div>
      )}
    </section>
  );
}

/** Confirma un token opaco y refresca la lista de grupos del usuario autenticado. */
export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  });
  const mutation = useMutation({
    mutationFn: ({ token }: AcceptInvitationValues) => cabalesApi.acceptInvitation(token),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Colaboración</p>
          <h1>Aceptar invitación</h1>
        </div>
      </header>
      {mutation.data ? (
        <StatusPanel
          title="Ya formas parte del grupo"
          action={
            <Link className="button primary" to={`/app/groups/${mutation.data.groupId}`}>
              Abrir grupo
            </Link>
          }
        >
          <p>La membresía fue confirmada con rol {mutation.data.role}.</p>
        </StatusPanel>
      ) : (
        <section className="form-card glass-panel">
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
            <label htmlFor="invitation-token">Token de invitación</label>
            <textarea
              id="invitation-token"
              rows={3}
              aria-describedby="invitation-token-error"
              {...form.register('token')}
            />
            <FieldError
              id="invitation-token-error"
              message={form.formState.errors.token?.message}
            />
            {mutation.isError && <ErrorMessage error={mutation.error} />}
            <button className="button primary" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Aceptando…' : 'Aceptar invitación'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
