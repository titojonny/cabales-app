import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { moduleQueries } from '../api/module-queries';
import { queries, queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { eventSchema, groupSchema, type EventValues, type GroupValues } from '../domain/validation';
import { ErrorMessage, FieldError, Icon, StatusPanel } from '../components/ui';
import { GroupTabs } from '../components/GroupTabs';
import { CategoryManager } from './BudgetPages';
import { GroupInvitationForm, InvitationList } from './InvitationPage';

const roleLabels = { OWNER: 'Propietario', ADMIN: 'Administrador', MEMBER: 'Miembro' } as const;

function localDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

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
            <Button variant="tertiary" type="button" onPress={() => void groups.refetch()}>
              Reintentar
            </Button>
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
        <form
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate({
              name: values.name,
              currency: values.currency,
              ...(values.description ? { description: values.description } : {}),
            }),
          )}
          noValidate
        >
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
            <Button variant="primary" type="submit" isDisabled={mutation.isPending}>
              {mutation.isPending ? 'Creando…' : 'Crear grupo'}
            </Button>
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
/**
 * Pestaña visible del grupo; las consultas de eventos solo se habilitan cuando corresponde.
 */
export function GroupDetailPage({ tab }: { tab: 'summary' | 'events' }) {
  const { groupId = '' } = useParams();
  const { session } = useAuth();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const events = useQuery({ ...queries.events(groupId), enabled: tab === 'events' });
  const achievementMembers = useQuery({
    ...moduleQueries.achievementMembers(groupId),
    enabled: tab === 'summary',
  });
  const achievementRanking = useQuery({
    ...moduleQueries.achievementRanking(groupId),
    enabled: tab === 'summary',
  });
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
      <GroupTabs groupId={groupId} />
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
                  {group.data.members.map((member) => {
                    const badges =
                      achievementMembers.data?.find((row) => row.user.id === member.user?.id)
                        ?.badges ?? [];
                    return (
                      <li key={member.id}>
                        <span className="avatar" aria-hidden="true">
                          {(member.user?.displayName || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{member.user?.displayName || 'Miembro sin perfil'}</strong>
                          <small>{roleLabels[member.role]}</small>
                          {badges.length > 0 && (
                            <span
                              className="chip-list"
                              aria-label={`Insignias de ${member.user?.displayName}`}
                            >
                              {badges.map((badge) => (
                                <span className="status-chip success" key={badge.code}>
                                  {badge.name} ·{' '}
                                  {badge.level === 'GOLD'
                                    ? 'Oro'
                                    : badge.level === 'SILVER'
                                      ? 'Plata'
                                      : 'Bronce'}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">La API no devolvió integrantes para este grupo.</p>
              )}
            </article>
          </div>
          {achievementMembers.isError && <ErrorMessage error={achievementMembers.error} />}
          {achievementRanking.isPending && <p className="muted" aria-busy="true">Calculando ranking…</p>}
          {achievementRanking.isError && <ErrorMessage error={achievementRanking.error} />}
          {achievementRanking.data && achievementRanking.data.length > 0 && (
            <section className="members-card glass-panel" aria-labelledby="group-ranking-title">
              <h2 id="group-ranking-title">Ranking del grupo</h2>
              <p className="muted small">
                Puntos por insignias; solo aparecen quienes decidieron participar.
              </p>
              <ol className="notification-list">
                {achievementRanking.data.map((row) => (
                  <li key={row.user.id}>
                    <span className="avatar" aria-hidden="true">
                      {row.rank}
                    </span>
                    <span className="grow">
                      <strong>{row.user.displayName}</strong>
                      <small>
                        {row.points} puntos · {row.badges.length} insignias
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {achievementRanking.data?.length === 0 && (
            <p className="muted">Aún no hay insignias visibles en el ranking.</p>
          )}
          {['OWNER', 'ADMIN'].includes(group.data.currentRole ?? '') && (
            <div className="admin-grid">
              <GroupInvitationForm groupId={groupId} />
              <InvitationList groupId={groupId} />
            </div>
          )}
          <CategoryManager
            groupId={groupId}
            canManage={['OWNER', 'ADMIN'].includes(group.data.currentRole ?? '')}
          />
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
  const [searchParams] = useSearchParams();
  const repeatFrom = searchParams.get('repeatFrom') ?? '';
  const { session } = useAuth();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [guestDraft, setGuestDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState({ label: '', url: '' });
  const repeatTemplate = useQuery({ queryKey: ['repeat-event-template', groupId, repeatFrom], queryFn: () => cabalesApi.repeatEventTemplate(groupId, repeatFrom), enabled: Boolean(repeatFrom), retry: false });
  const repeatPrefilled = useRef(false);
  const form = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      startsAt: '',
      endsAt: '',
      locationName: '',
      locationAddress: '',
      mapsUrl: '',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      memberIds: [],
      guests: [],
      links: [],
    },
  });
  const memberIds = form.watch('memberIds');
  const guests = form.watch('guests');
  const links = form.watch('links');
  useEffect(() => {
    if (!repeatTemplate.data || repeatPrefilled.current) return;
    repeatPrefilled.current = true;
    const template = repeatTemplate.data as { name: string; description?: string; startsAt: string; endsAt?: string; locationName?: string; locationAddress?: string; mapsUrl?: string; timeZone?: string; memberIds: string[]; guests: string[]; links: Array<{ label: string; url: string }> };
    form.reset({ name: template.name, description: template.description ?? '', startsAt: localDateTime(template.startsAt), endsAt: template.endsAt ? localDateTime(template.endsAt) : '', locationName: template.locationName ?? '', locationAddress: template.locationAddress ?? '', mapsUrl: template.mapsUrl ?? '', timeZone: template.timeZone ?? '', memberIds: template.memberIds, guests: template.guests, links: template.links });
  }, [form, repeatTemplate.data]);
  const mutation = useMutation({
    mutationFn: (values: EventValues) =>
      cabalesApi.createEvent(groupId, {
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
        startsAt: new Date(values.startsAt).toISOString(),
        ...(values.endsAt ? { endsAt: new Date(values.endsAt).toISOString() } : {}),
        ...(values.locationName ? { locationName: values.locationName } : {}),
        ...(values.locationAddress ? { locationAddress: values.locationAddress } : {}),
        ...(values.mapsUrl ? { mapsUrl: values.mapsUrl } : {}),
        ...(values.timeZone ? { timeZone: values.timeZone } : {}),
        memberIds: values.memberIds,
        guests: values.guests,
        links: values.links,
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
          <label htmlFor="ends-at">
            Fecha y hora de fin <span className="optional">Opcional</span>
          </label>
          <input id="ends-at" type="datetime-local" {...form.register('endsAt')} />
          <FieldError id="ends-at-error" message={form.formState.errors.endsAt?.message} />
          <label htmlFor="event-description">
            Descripción <span className="optional">Opcional</span>
          </label>
          <textarea id="event-description" rows={3} {...form.register('description')} />
          <label htmlFor="event-location-name">
            Lugar <span className="optional">Opcional</span>
          </label>
          <input id="event-location-name" {...form.register('locationName')} />
          <label htmlFor="event-location-address">Dirección</label>
          <input id="event-location-address" {...form.register('locationAddress')} />
          <label htmlFor="event-maps-url">Enlace de Maps</label>
          <input
            id="event-maps-url"
            type="url"
            placeholder="https://maps.google.com/"
            {...form.register('mapsUrl')}
          />
          <label htmlFor="event-time-zone">Zona horaria</label>
          <input id="event-time-zone" {...form.register('timeZone')} />
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
              <Button variant="tertiary" type="button" onPress={addGuest}>
                Agregar
              </Button>
            </div>
            <div className="chip-list">
              {guests.map((guest, index) => (
                <Button
                  variant="tertiary"
                  className="status-chip pending"
                  type="button"
                  key={`${guest}-${index}`}
                  onPress={() =>
                    form.setValue(
                      'guests',
                      guests.filter((_, guestIndex) => guestIndex !== index),
                      { shouldValidate: true },
                    )
                  }
                  aria-label={`Quitar a ${guest}`}
                >
                  {guest} ×
                </Button>
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
            <Button variant="tertiary" type="button" onPress={addLink}>
              Agregar enlace
            </Button>
            <div className="chip-list">
              {links.map((link, index) => (
                <Button
                  variant="tertiary"
                  className="status-chip pending"
                  type="button"
                  key={`${link.url}-${index}`}
                  onPress={() =>
                    form.setValue(
                      'links',
                      links.filter((_, linkIndex) => linkIndex !== index),
                      { shouldValidate: true },
                    )
                  }
                  aria-label={`Quitar enlace ${link.label}`}
                >
                  {link.label} ×
                </Button>
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
            <Button variant="primary" type="submit" isDisabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando…' : 'Crear evento'}
            </Button>
            <Link className="button quiet" to={`/app/groups/${groupId}/events`}>
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </PageHeader>
  );
}

/** Encabezado de página reutilizable con acción opcional y contenido de la sección. */
export function PageHeader({
  eyebrow,
  title,
  action,
  children,
}: {
  /** Texto secundario que ubica la sección actual. */
  eyebrow: string;
  /** Título principal de la pantalla. */
  title: string;
  /** Acción contextual, normalmente un enlace o botón autorizado. */
  action?: React.ReactNode;
  /** Contenido específico que cada pantalla compone debajo del encabezado. */
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
