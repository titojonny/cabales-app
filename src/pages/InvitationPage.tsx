import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import type { CreatedInvitation, Invitation } from '../api/contracts';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import { modulesApi } from '../api/modules-api';
import { queryKeys } from '../api/queries';
import {
  ErrorMessage,
  ErrorState,
  FieldError,
  formatDate,
  LoadingState,
  StatusPanel,
} from '../components/ui';
import {
  acceptInvitationSchema,
  invitationSchema,
  type AcceptInvitationValues,
  type InvitationValues,
} from '../domain/validation';

const roleLabel = { OWNER: 'Propietario', ADMIN: 'Administrador', MEMBER: 'Miembro' } as const;
const statusLabel: Record<Invitation['status'], string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REVOKED: 'Revocada',
  EXPIRED: 'Vencida',
};

function invitationLink(token: string): string {
  return `${window.location.origin}/app/invitations/accept#token=${encodeURIComponent(token)}`;
}

/** Enlace de un solo uso para compartir cuando no hay correo o como respaldo. */
function InvitationLinkResult({ result }: { result: CreatedInvitation }) {
  const [copied, setCopied] = useState(false);
  const url = invitationLink(result.token);
  return (
    <div className="invitation-result" role="status">
      <strong>
        {result.delivery === 'email'
          ? `Enviamos la invitación a ${result.invitation.email}`
          : 'Invitación creada; comparte el enlace'}
      </strong>
      <p>
        {result.delivery === 'email'
          ? 'Si no llega, también puedes compartir este enlace de forma privada.'
          : `El envío por correo no está configurado. Comparte este enlace solo con ${result.invitation.email}.`}
      </p>
      <input aria-label="Enlace de invitación" readOnly value={url} />
      <div className="button-row">
        <Button
          variant="tertiary"
          type="button"
          onPress={() =>
            void navigator.clipboard
              ?.writeText(url)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
      </div>
      <small>Expira: {formatDate(result.invitation.expiresAt, true)}</small>
    </div>
  );
}

/** Crea una invitación con el rol seleccionado y muestra su resultado según el contrato vigente. */
export function GroupInvitationForm({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const form = useForm<InvitationValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });
  const mutation = useMutation({
    mutationFn: (values: InvitationValues) => cabalesApi.createInvitation(groupId, values),
    onSuccess: () => {
      form.reset({ email: '', role: form.getValues('role') });
      void queryClient.invalidateQueries({ queryKey: moduleKeys.invitations(groupId) });
    },
  });

  return (
    <section className="form-card glass-panel invitation-card">
      <h2>Invitar persona</h2>
      <p className="muted">
        Solo propietarios y administradores pueden invitar. La invitación caduca en unos días.
      </p>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <label htmlFor="invite-email">Correo</label>
        <input
          id="invite-email"
          type="email"
          autoComplete="off"
          aria-describedby="invite-email-error"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
        <FieldError id="invite-email-error" message={form.formState.errors.email?.message} />
        <label htmlFor="invite-role">Rol</label>
        <select id="invite-role" {...form.register('role')}>
          <option value="MEMBER">Miembro</option>
          <option value="ADMIN">Administrador</option>
        </select>
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <Button variant="primary" type="submit" isDisabled={mutation.isPending}>
          {mutation.isPending ? 'Invitando…' : 'Enviar invitación'}
        </Button>
      </form>
      {mutation.data && <InvitationLinkResult result={mutation.data} />}
    </section>
  );
}

/** Seguimiento de invitaciones: reenviar rota el enlace; revocar lo invalida. */
export function InvitationList({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const invitations = useQuery(moduleQueries.invitations(groupId));
  const [lastResent, setLastResent] = useState<CreatedInvitation>();
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: moduleKeys.invitations(groupId) });
  const resend = useMutation({
    mutationFn: (invitationId: string) => modulesApi.resendInvitation(groupId, invitationId),
    onSuccess: (result) => {
      setLastResent(result);
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (invitationId: string) => modulesApi.revokeInvitation(groupId, invitationId),
    onSuccess: refresh,
  });

  return (
    <section className="members-card glass-panel invitation-list">
      <h2>Invitaciones</h2>
      {invitations.isPending && <p aria-busy="true">Cargando invitaciones…</p>}
      {invitations.isError && <ErrorMessage error={invitations.error} />}
      {invitations.data?.length === 0 && <p className="muted">Aún no has invitado a nadie.</p>}
      {invitations.data && invitations.data.length > 0 && (
        <ul>
          {invitations.data.map((invitation) => {
            const canResend = invitation.status === 'PENDING' || invitation.status === 'EXPIRED';
            return (
              <li key={invitation.id}>
                <span className="avatar" aria-hidden="true">
                  {invitation.email.slice(0, 1).toUpperCase()}
                </span>
                <span className="grow">
                  <strong className="truncate">{invitation.email}</strong>
                  <small>
                    {roleLabel[invitation.role]} · {statusLabel[invitation.status]}
                    {invitation.status === 'PENDING' &&
                      ` · caduca ${formatDate(invitation.expiresAt)}`}
                  </small>
                </span>
                {canResend && (
                  <span className="row-actions">
                    <Button
                      variant="tertiary"
                      size="sm"
                      type="button"
                      isDisabled={resend.isPending}
                      onPress={() => resend.mutate(invitation.id)}
                      aria-label={`Reenviar invitación a ${invitation.email}`}
                    >
                      Reenviar
                    </Button>
                    {invitation.status === 'PENDING' && (
                      <Button
                        variant="danger-soft"
                        size="sm"
                        type="button"
                        isDisabled={revoke.isPending}
                        onPress={() => {
                          if (window.confirm(`¿Revocar la invitación de ${invitation.email}?`))
                            revoke.mutate(invitation.id);
                        }}
                        aria-label={`Revocar invitación de ${invitation.email}`}
                      >
                        Revocar
                      </Button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(resend.isError || revoke.isError) && <ErrorMessage error={resend.error ?? revoke.error} />}
      {lastResent && <InvitationLinkResult result={lastResent} />}
    </section>
  );
}

/** Extrae el token de un enlace completo o de un token pegado directamente. */
export function extractInvitationToken(value: string): string {
  const trimmed = value.trim();
  const fromHash = /[#?&]token=([A-Za-z0-9_-]+)/.exec(trimmed)?.[1];
  return fromHash ?? trimmed;
}

/** Lee el token del fragmento (o de `?token=` por compatibilidad) y lo quita del historial. */
function useInitialInvitationToken(): string {
  const [token] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    const query = new URLSearchParams(window.location.search).get('token');
    const value = hash ?? query ?? '';
    if (value) window.history.replaceState(window.history.state, '', window.location.pathname);
    return value;
  });
  return token;
}

/** Muestra a qué grupo invita el enlace y confirma la membresía. */
export function AcceptInvitationPage() {
  const initialToken = useInitialInvitationToken();
  const [token, setToken] = useState(initialToken);
  const queryClient = useQueryClient();
  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { token: initialToken },
  });
  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => modulesApi.previewInvitation(token),
    enabled: token.length >= 20,
    retry: false,
    staleTime: Infinity,
  });
  const mutation = useMutation({
    mutationFn: () => cabalesApi.acceptInvitation(token),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
  });

  let content;
  if (mutation.data) {
    content = (
      <StatusPanel
        title="Ya formas parte del grupo"
        action={
          <Link className="button primary" to={`/app/groups/${mutation.data.groupId}`}>
            Abrir grupo
          </Link>
        }
      >
        <p>Te uniste como {roleLabel[mutation.data.role].toLowerCase()}.</p>
      </StatusPanel>
    );
  } else if (!token) {
    content = (
      <section className="form-card glass-panel">
        <p className="muted">Pega el enlace o el token que recibiste.</p>
        <form
          onSubmit={form.handleSubmit((values) => setToken(extractInvitationToken(values.token)))}
          noValidate
        >
          <label htmlFor="invitation-token">Token de invitación</label>
          <textarea
            id="invitation-token"
            rows={3}
            aria-describedby="invitation-token-error"
            {...form.register('token')}
          />
          <FieldError id="invitation-token-error" message={form.formState.errors.token?.message} />
          <Button variant="primary" type="submit">
            Revisar invitación
          </Button>
        </form>
      </section>
    );
  } else if (preview.isPending) {
    content = <LoadingState title="Revisando invitación">Validando el enlace…</LoadingState>;
  } else if (preview.isError) {
    content = <ErrorState title="Esta invitación no está disponible" error={preview.error} />;
  } else {
    const data = preview.data;
    const usable = data.status === 'PENDING';
    content = (
      <section className="form-card glass-panel invitation-preview">
        <p className="eyebrow">Te invitaron a</p>
        <h2>{data.groupName}</h2>
        <p>
          {data.invitedBy} te invitó como {roleLabel[data.role].toLowerCase()}.
          {usable && ` Caduca el ${formatDate(data.expiresAt, true)}.`}
        </p>
        {!usable && (
          <p className="form-error" role="alert">
            La invitación está {statusLabel[data.status].toLowerCase()}. Pide una nueva a quien te
            invitó.
          </p>
        )}
        {usable && !data.emailMatches && (
          <p className="form-error" role="alert">
            Esta invitación es para otro correo. Inicia sesión con la cuenta invitada para
            aceptarla.
          </p>
        )}
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <div className="button-row">
          <Button
            variant="primary"
            type="button"
            isDisabled={!usable || !data.emailMatches || mutation.isPending}
            onPress={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Aceptando…' : 'Aceptar invitación'}
          </Button>
          <Link className="button quiet" to="/app">
            Ahora no
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Colaboración</p>
          <h1>Aceptar invitación</h1>
        </div>
      </header>
      {content}
    </div>
  );
}
