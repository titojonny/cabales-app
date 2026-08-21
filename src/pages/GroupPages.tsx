import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { queries, queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { eventSchema, groupSchema, type EventValues, type GroupValues } from '../domain/validation';
import { ErrorMessage, FieldError, Icon, StatusPanel } from '../components/ui';
import { GroupInvitationForm } from './InvitationPage';

/** Lista grupos reales y representa por separado carga, error y ausencia de datos. */
export function DashboardPage() {
  const groups = useQuery(queries.groups());
  return (
    <PageHeader
      eyebrow="Tu espacio"
      title="Grupos en balance"
      action={
        <Link className="button primary" to="/app/groups/new">
          <Icon name="plus" />
          Nuevo grupo
        </Link>
      }
    >
      {groups.isPending && (
        <StatusPanel title="Buscando grupos">
          <p>Consultando tus espacios compartidos…</p>
        </StatusPanel>
      )}
      {groups.isError && (
        <StatusPanel
          title="No pudimos cargar los grupos"
          action={
            <button className="button quiet" type="button" onClick={() => void groups.refetch()}>
              Reintentar
            </button>
          }
        >
          <ErrorMessage error={groups.error} />
        </StatusPanel>
      )}
      {groups.data?.length === 0 && (
        <StatusPanel
          title="Todavía no hay grupos"
          action={
            <Link className="button primary" to="/app/groups/new">
              Crear el primero
            </Link>
          }
        >
          <p>Crea un grupo para reunir personas, eventos y gastos.</p>
        </StatusPanel>
      )}
      {groups.data && groups.data.length > 0 && (
        <div className="card-grid">
          {groups.data.map((group, index) => (
            <Link className="group-card glass-panel" to={`/app/groups/${group.id}`} key={group.id}>
              <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{group.name}</h2>
                <p>{group.description || 'Sin descripción'}</p>
              </div>
              <footer>
                <span>{group.memberCount ?? group.members?.length ?? '—'} integrantes</span>
                <strong>{group.currency}</strong>
              </footer>
            </Link>
          ))}
        </div>
      )}
    </PageHeader>
  );
}

/** Crea un grupo con una carga normalizada e invalida solo su colección. */
export function CreateGroupPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<GroupValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '', description: '', currency: 'USD' },
  });
  const mutation = useMutation({
    mutationFn: cabalesApi.createGroup,
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      navigate(`/app/groups/${group.id}`);
    },
  });
  return (
    <PageHeader eyebrow="Nuevo espacio" title="Crear grupo">
      <section className="form-card glass-panel">
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <label htmlFor="group-name">Nombre</label>
          <input id="group-name" aria-describedby="group-name-error" {...form.register('name')} />
          <FieldError id="group-name-error" message={form.formState.errors.name?.message} />
          <label htmlFor="group-description">
            Descripción <span className="optional">Opcional</span>
          </label>
          <textarea
            id="group-description"
            rows={3}
            aria-describedby="group-description-error"
            {...form.register('description')}
          />
          <FieldError
            id="group-description-error"
            message={form.formState.errors.description?.message}
          />
          <label htmlFor="currency">Moneda base</label>
          <select id="currency" {...form.register('currency')}>
            <option value="USD">USD — Dólar</option>
            <option value="CRC">CRC — Colón</option>
            <option value="EUR">EUR — Euro</option>
          </select>
          {mutation.isError && <ErrorMessage error={mutation.error} />}
          <div className="button-row">
            <button className="button primary" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando…' : 'Crear grupo'}
            </button>
            <Link className="button quiet" to="/app/groups">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </PageHeader>
  );
}

/** Presenta el detalle del grupo con pestañas de resumen, eventos y liquidaciones. */
export function GroupDetailPage({ tab }: { tab: 'summary' | 'events' }) {
  const { groupId = '' } = useParams();
  const { session } = useAuth();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const events = useQuery({ ...queries.events(groupId), enabled: tab === 'events' });
  if (group.isPending)
    return (
      <StatusPanel title="Cargando grupo">
        <p>Consultando integrantes y configuración…</p>
      </StatusPanel>
    );
  if (group.isError)
    return (
      <StatusPanel title="No pudimos abrir el grupo">
        <ErrorMessage error={group.error} />
      </StatusPanel>
    );
  return (
    <PageHeader
      eyebrow={group.data.currency}
      title={group.data.name}
      action={
        tab === 'events' ? (
          <Link className="button primary" to={`/app/groups/${groupId}/events/new`}>
            <Icon name="plus" />
            Nuevo evento
          </Link>
        ) : undefined
      }
    >
      <div className="tabs" role="tablist" aria-label="Secciones del grupo">
        <Link
          role="tab"
          aria-selected={tab === 'summary'}
          className={tab === 'summary' ? 'active' : ''}
          to={`/app/groups/${groupId}`}
        >
          Resumen
        </Link>
        <Link
          role="tab"
          aria-selected={tab === 'events'}
          className={tab === 'events' ? 'active' : ''}
          to={`/app/groups/${groupId}/events`}
        >
          Eventos
        </Link>
        <Link role="tab" aria-selected="false" to={`/app/groups/${groupId}/settlements`}>
          Liquidaciones
        </Link>
      </div>
      {tab === 'summary' && (
        <>
          <div className="summary-grid">
            <article className="metric-card">
              <span>Integrantes</span>
              <strong>{group.data.memberCount ?? group.data.members?.length ?? '—'}</strong>
              <small>Según el detalle de API</small>
            </article>
            <article className="metric-card">
              <span>Moneda base</span>
              <strong>{group.data.currency}</strong>
              <small>Para nuevos repartos</small>
            </article>
            <article className="members-card glass-panel">
              <h2>Personas</h2>
              {group.data.members?.length ? (
                <ul>
                  {group.data.members.map((member) => (
                    <li key={member.id}>
                      <span className="avatar" aria-hidden="true">
                        {(member.user?.displayName || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <strong>{member.user?.displayName || 'Miembro sin perfil'}</strong>
                        <small>{member.user?.email || member.role}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">La API no devolvió integrantes para este grupo.</p>
              )}
            </article>
          </div>
          {['OWNER', 'ADMIN'].includes(group.data.currentRole ?? '') && (
            <GroupInvitationForm groupId={groupId} />
          )}
        </>
      )}
      {tab === 'events' && (
        <>
          {events.isPending && (
            <StatusPanel title="Cargando eventos">
              <p>Consultando actividades del grupo…</p>
            </StatusPanel>
          )}
          {events.isError && (
            <StatusPanel title="No pudimos cargar los eventos">
              <ErrorMessage error={events.error} />
            </StatusPanel>
          )}
          {events.data?.length === 0 && (
            <StatusPanel
              title="No hay eventos todavía"
              action={
                <Link className="button primary" to={`/app/groups/${groupId}/events/new`}>
                  Crear evento
                </Link>
              }
            >
              <p>Un evento reúne los gastos de una salida o actividad.</p>
            </StatusPanel>
          )}
          {events.data && events.data.length > 0 && (
            <div className="event-list">
              {events.data.map((event) => (
                <article className="event-row glass-panel" key={event.id}>
                  <div className="date-block">
                    <strong>
                      {new Date(event.startsAt).toLocaleDateString('es', { day: '2-digit' })}
                    </strong>
                    <span>
                      {new Date(event.startsAt).toLocaleDateString('es', { month: 'short' })}
                    </span>
                  </div>
                  <div>
                    <h2>
                      <Link to={`/app/groups/${groupId}/events/${event.id}`}>{event.name}</Link>
                    </h2>
                    <p>
                      {event.description || 'Sin descripción'} · {event.expenseCount ?? '—'} gastos
                    </p>
                  </div>
                  <Link className="button quiet" to={`/app/groups/${groupId}/events/${event.id}`}>
                    Ver evento
                  </Link>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </PageHeader>
  );
}

/** Crea un evento asociado al identificador validado por la ruta y refresca su lista. */
export function CreateEventPage() {
  const { groupId = '' } = useParams();
  const { session } = useAuth();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [guestDraft, setGuestDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState({ label: '', url: '' });
  const form = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      startsAt: '',
      memberIds: [],
      guests: [],
      links: [],
    },
  });
  const memberIds = form.watch('memberIds');
  const guests = form.watch('guests');
  const links = form.watch('links');
  const mutation = useMutation({
    mutationFn: (values: EventValues) =>
      cabalesApi.createEvent(groupId, {
        ...values,
        startsAt: new Date(values.startsAt).toISOString(),
      }),
    onSuccess: (event) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
      navigate(`/app/groups/${groupId}/events/${event.id}`);
    },
  });

  const addGuest = () => {
    const guest = guestDraft.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (!guest) return;
    form.setValue('guests', [...guests, guest], { shouldValidate: true });
    setGuestDraft('');
  };
  const addLink = () => {
    if (!linkDraft.label.trim() || !linkDraft.url.trim()) return;
    form.setValue('links', [...links, linkDraft], { shouldValidate: true });
    setLinkDraft({ label: '', url: '' });
  };

  if (group.isPending)
    return (
      <StatusPanel title="Preparando evento">
        <p>Cargando integrantes disponibles…</p>
      </StatusPanel>
    );
  if (group.isError)
    return (
      <StatusPanel title="No pudimos preparar el evento">
        <ErrorMessage error={group.error} />
      </StatusPanel>
    );

  return (
    <PageHeader eyebrow="Actividad compartida" title="Nuevo evento">
      <section className="form-card glass-panel">
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <label htmlFor="event-name">Nombre</label>
          <input id="event-name" aria-describedby="event-name-error" {...form.register('name')} />
          <FieldError id="event-name-error" message={form.formState.errors.name?.message} />
          <label htmlFor="starts-at">Fecha y hora</label>
          <input
            id="starts-at"
            type="datetime-local"
            aria-describedby="starts-at-error"
            {...form.register('startsAt')}
          />
          <FieldError id="starts-at-error" message={form.formState.errors.startsAt?.message} />
          <label htmlFor="event-description">
            Descripción <span className="optional">Opcional</span>
          </label>
          <textarea id="event-description" rows={3} {...form.register('description')} />
          <fieldset>
            <legend>Integrantes del grupo</legend>
            <p className="muted">Tu membresía se añade automáticamente como creadora.</p>
            <div className="participant-list">
              {(group.data.members ?? [])
                .filter((member) => member.id !== group.data.currentMemberId)
                .map((member) => (
                  <label className="participant" key={member.id}>
                    <span>{member.user?.displayName || `Miembro ${member.id.slice(0, 8)}`}</span>
                    <input
                      type="checkbox"
                      checked={memberIds.includes(member.id)}
                      onChange={(change) =>
                        form.setValue(
                          'memberIds',
                          change.target.checked
                            ? [...memberIds, member.id]
                            : memberIds.filter((id) => id !== member.id),
                          { shouldValidate: true },
                        )
                      }
                    />
                  </label>
                ))}
            </div>
            <FieldError id="member-ids-error" message={form.formState.errors.memberIds?.message} />
          </fieldset>
          <fieldset>
            <legend>Invitados sin cuenta</legend>
            <div className="inline-entry">
              <input
                aria-label="Nombre del invitado"
                value={guestDraft}
                maxLength={120}
                onChange={(change) => setGuestDraft(change.target.value)}
              />
              <button className="button quiet" type="button" onClick={addGuest}>
                Agregar
              </button>
            </div>
            <div className="chip-list">
              {guests.map((guest, index) => (
                <button
                  className="status-chip pending"
                  type="button"
                  key={`${guest}-${index}`}
                  onClick={() =>
                    form.setValue(
                      'guests',
                      guests.filter((_, guestIndex) => guestIndex !== index),
                      { shouldValidate: true },
                    )
                  }
                  aria-label={`Quitar a ${guest}`}
                >
                  {guest} ×
                </button>
              ))}
            </div>
            <FieldError id="guests-error" message={form.formState.errors.guests?.message} />
          </fieldset>
          <fieldset>
            <legend>
              Enlaces http/https <span className="optional">Opcional</span>
            </legend>
            <div className="field-pair">
              <input
                aria-label="Etiqueta del enlace"
                placeholder="Reserva"
                value={linkDraft.label}
                onChange={(change) =>
                  setLinkDraft((current) => ({ ...current, label: change.target.value }))
                }
              />
              <input
                aria-label="URL del enlace"
                type="url"
                placeholder="https://"
                value={linkDraft.url}
                onChange={(change) =>
                  setLinkDraft((current) => ({ ...current, url: change.target.value }))
                }
              />
            </div>
            <button className="button quiet" type="button" onClick={addLink}>
              Agregar enlace
            </button>
            <div className="chip-list">
              {links.map((link, index) => (
                <button
                  className="status-chip pending"
                  type="button"
                  key={`${link.url}-${index}`}
                  onClick={() =>
                    form.setValue(
                      'links',
                      links.filter((_, linkIndex) => linkIndex !== index),
                      { shouldValidate: true },
                    )
                  }
                  aria-label={`Quitar enlace ${link.label}`}
                >
                  {link.label} ×
                </button>
              ))}
            </div>
            <FieldError
              id="links-error"
              message={
                form.formState.errors.links?.message ||
                form.formState.errors.links?.[0]?.url?.message ||
                form.formState.errors.links?.[0]?.label?.message
              }
            />
          </fieldset>
          {mutation.isError && <ErrorMessage error={mutation.error} />}
          <div className="button-row">
            <button className="button primary" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando…' : 'Crear evento'}
            </button>
            <Link className="button quiet" to={`/app/groups/${groupId}/events`}>
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </PageHeader>
  );
}

/** Encabezado consistente que deja la responsabilidad de datos a cada pantalla. */
export function PageHeader({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
