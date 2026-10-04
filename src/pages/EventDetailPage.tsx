import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import { modulesApi } from '../api/modules-api';
import { queries, queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { EventComments } from '../components/EventComments';
import { PublicShareActions } from '../components/PublicShareActions';
import { ErrorMessage, Icon, StatusPanel, formatDate } from '../components/ui';
import { formatMoney } from '../domain/money';
import { participantLabel } from '../domain/participants';
import { PageHeader } from './GroupPages';

type RsvpStatus = 'PENDING' | 'GOING' | 'MAYBE' | 'DECLINED';
const rsvpLabels: Record<RsvpStatus, string> = {
  PENDING: 'Pendiente',
  GOING: 'Voy',
  MAYBE: 'Tal vez',
  DECLINED: 'No voy',
};
const reminderOptions = [1440, 60, 30, 15, 5];

/** Detalle completo del evento: RSVP propio, asistentes, recordatorios y ciclo de vida. */
export function EventDetailPage() {
  const { groupId = '', eventId = '' } = useParams();
  const { session } = useAuth();
  const event = useQuery(queries.event(groupId, eventId));
  const eventFunds = useQuery({ queryKey: ['event-funds', groupId, eventId], queryFn: () => cabalesApi.eventFunds(groupId, eventId) });
  const availableFunds = useQuery({ ...moduleQueries.funds(groupId), enabled: Boolean(groupId) });
  const group = useQuery({
    ...queries.group(groupId, session?.user.id ?? ''),
    enabled: Boolean(session?.user.id),
  });
  const [expenseText, setExpenseText] = useState('');
  const [expenseTagId, setExpenseTagId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const expenses = useQuery(
    queries.expenses(groupId, {
      ...(expenseText ? { text: expenseText } : {}),
      ...(expenseTagId ? { tagId: expenseTagId } : {}),
      ...(expenseCategoryId ? { categoryId: expenseCategoryId } : {}),
    }),
  );
  const tags = useQuery(moduleQueries.groupTags(groupId));
  const categories = useQuery(moduleQueries.categories(groupId));
  const queryClient = useQueryClient();
  const [reminders, setReminders] = useState<number[]>([]);
  const [newGroupTag, setNewGroupTag] = useState('');
  const createGroupTag = useMutation({
    mutationFn: () => modulesApi.createGroupTag(groupId, newGroupTag.trim()),
    onSuccess: () => { setNewGroupTag(''); void queryClient.invalidateQueries({ queryKey: moduleKeys.groupTags(groupId) }); },
  });

  useEffect(() => {
    if (event.data)
      setReminders(
        event.data.reminders?.filter((item) => item.enabled).map((item) => item.minutesBefore) ??
          [],
      );
  }, [event.data]);

  const rsvpMutation = useMutation({
    mutationFn: (status: RsvpStatus) => cabalesApi.rsvpEvent(groupId, eventId, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.event(groupId, eventId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
    },
  });
  const remindersMutation = useMutation({
    mutationFn: () =>
      cabalesApi.updateEventReminders(
        groupId,
        eventId,
        reminders.map((minutesBefore) => ({ minutesBefore, enabled: true })),
      ),
    onSuccess: (updated) => queryClient.setQueryData(queryKeys.event(groupId, eventId), updated),
  });
  const configuredReminderOptions = useMemo(
    () => [...new Set([...reminderOptions, ...reminders])].sort((a, b) => b - a),
    [reminders],
  );

  if (event.isPending)
    return (
      <StatusPanel title="Cargando evento">
        <p>Consultando participantes y actividad…</p>
      </StatusPanel>
    );
  if (event.isError)
    return (
      <StatusPanel title="No pudimos abrir el evento">
        <ErrorMessage error={event.error} />
      </StatusPanel>
    );

  const eventData = event.data;
  const attendees = eventData.participants ?? [];
  const counts = eventData.rsvpCounts ?? { PENDING: 0, GOING: 0, MAYBE: 0, DECLINED: 0 };
  const currentParticipant = attendees.find(
    (participant) => participant.groupMember?.user?.id === session?.user.id,
  );
  const canManage = Boolean(
    eventData.createdById === session?.user.id ||
    ['OWNER', 'ADMIN'].includes(group.data?.currentRole ?? ''),
  );
  const canManageGroupResources = ['OWNER', 'ADMIN'].includes(group.data?.currentRole ?? '');
  const canAddExpense = eventData.status === 'OPEN' && !eventData.settlement;
  const eventExpenses = (expenses.data ?? []).filter((expense) => expense.eventId === eventId);
  return (
    <PageHeader
      eyebrow={eventStatusLabel(eventData.status)}
      title={eventData.name}
      action={
        <div className="button-row">
          {canManage && (
            <Link className="button quiet" to={`/app/groups/${groupId}/events/${eventId}/edit`}>
              Editar
            </Link>
          )}
          <Link className="button quiet" to={`/app/groups/${groupId}/events/new?repeatFrom=${eventId}`}>
            Repetir evento
          </Link>
          {canAddExpense && (
            <Link
              className="button primary"
              to={`/app/groups/${groupId}/events/${eventId}/expenses/new`}
            >
              <Icon name="plus" /> Añadir gasto
            </Link>
          )}
        </div>
      }
    >
      <section className="event-overview glass-panel">
        <p>{eventData.description || 'Sin descripción'}</p>
        <dl className="event-facts">
          <div>
            <dt>Inicio</dt>
            <dd>{formatDate(eventData.startsAt, true)}</dd>
          </div>
          {eventData.endsAt && (
            <div>
              <dt>Fin</dt>
              <dd>{formatDate(eventData.endsAt, true)}</dd>
            </div>
          )}
          {(eventData.locationName || eventData.locationAddress) && (
            <div>
              <dt>Lugar</dt>
              <dd>
                {[eventData.locationName, eventData.locationAddress].filter(Boolean).join(' · ')}
              </dd>
            </div>
          )}
          {eventData.timeZone && (
            <div>
              <dt>Zona horaria</dt>
              <dd>{eventData.timeZone}</dd>
            </div>
          )}
        </dl>
        {eventData.mapsUrl && (
          <a href={eventData.mapsUrl} target="_blank" rel="noreferrer">
            Abrir ubicación en Maps
          </a>
        )}
      </section>

      {currentParticipant && eventData.status !== 'CANCELLED' && (
        <section className="members-card glass-panel" aria-labelledby="rsvp-title">
          <h2 id="rsvp-title">¿Vas a asistir?</h2>
          <p className="muted" aria-live="polite">
            Estado actual: {rsvpLabels[currentParticipant.rsvpStatus]}
          </p>
          <div className="rsvp-grid" role="group" aria-label="Estado de asistencia">
            {(Object.keys(rsvpLabels) as RsvpStatus[]).map((status) => (
              <Button
                key={status}
                variant={currentParticipant.rsvpStatus === status ? 'primary' : 'tertiary'}
                type="button"
                aria-pressed={currentParticipant.rsvpStatus === status}
                isDisabled={rsvpMutation.isPending}
                onPress={() => rsvpMutation.mutate(status)}
              >
                {rsvpLabels[status]}
              </Button>
            ))}
          </div>
          {rsvpMutation.isError && <ErrorMessage error={rsvpMutation.error} />}
        </section>
      )}

      <div className="summary-grid">
        <section className="members-card glass-panel" aria-labelledby="attendees-title">
          <h2 id="attendees-title">Asistencia</h2>
          <div className="rsvp-counts" aria-label="Recuento de asistencia">
            {(Object.keys(rsvpLabels) as RsvpStatus[]).map((status) => (
              <span key={status}>
                <strong>{counts[status]}</strong> {rsvpLabels[status]}
              </span>
            ))}
          </div>
          {(Object.keys(rsvpLabels) as RsvpStatus[]).map((status) => (
            <div className="attendee-group" key={status}>
              <h3>{rsvpLabels[status]}</h3>
              <ul>
                {attendees
                  .filter((participant) => participant.rsvpStatus === status)
                  .map((participant) => (
                    <li key={participant.id}>
                      <span className="avatar" aria-hidden="true">
                        {participantLabel(participant).slice(0, 1).toUpperCase()}
                      </span>
                      <strong>{participantLabel(participant)}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
        <section className="members-card glass-panel event-links" aria-labelledby="links-title">
          <h2 id="links-title">Enlaces</h2>
          {eventData.links?.length ? (
            <ul>
              {eventData.links.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Sin enlaces asociados.</p>
          )}
        </section>
      </div>

      <EventComments
        groupId={groupId}
        eventId={eventId}
        canModerate={['OWNER', 'ADMIN'].includes(group.data?.currentRole ?? '')}
      />
      <EventFundsPanel
        groupId={groupId}
        eventId={eventId}
        canManage={canManageGroupResources}
        linked={eventFunds.data ?? []}
        available={availableFunds.data ?? []}
        isLoading={eventFunds.isPending}
        onSaved={() => void eventFunds.refetch()}
      />
      <PublicShareActions groupId={groupId} target={{ eventId }} canManage={canManageGroupResources} />

      {canManage && eventData.status !== 'CANCELLED' && (
        <section className="members-card glass-panel" aria-labelledby="reminders-title">
          <h2 id="reminders-title">Recordatorios</h2>
          <p className="muted">
            Se enviarán a integrantes pendientes, con “voy” o “tal vez”, según sus preferencias.
          </p>
          <div className="reminder-options">
            {configuredReminderOptions.map((minutes) => (
              <label key={minutes} className="participant">
                <span>{formatReminder(minutes)}</span>
                <input
                  type="checkbox"
                  checked={reminders.includes(minutes)}
                  onChange={(change) =>
                    setReminders((current) =>
                      change.target.checked
                        ? [...current, minutes]
                        : current.filter((value) => value !== minutes),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <Button
            variant="primary"
            type="button"
            isDisabled={remindersMutation.isPending || reminders.length > 5}
            onPress={() => remindersMutation.mutate()}
          >
            {remindersMutation.isPending ? 'Guardando…' : 'Guardar recordatorios'}
          </Button>
          {reminders.length > 5 && (
            <p className="form-error" role="alert">
              Puedes elegir como máximo 5 recordatorios.
            </p>
          )}
          {remindersMutation.isError && <ErrorMessage error={remindersMutation.error} />}
        </section>
      )}

      {(canManage || eventData.status === 'CANCELLED') && (
        <EventActions
          canManage={canManage}
          groupId={groupId}
          eventId={eventId}
          cancelled={eventData.status === 'CANCELLED'}
          onCancelled={(updated) => {
            queryClient.setQueryData(queryKeys.event(groupId, eventId), updated);
            void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
          }}
          onDeleted={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
            window.location.assign(`/app/groups/${groupId}/events`);
          }}
        />
      )}

      <div className="section-heading"><h2 className="section-title">Gastos</h2><div className="filters-row"><label htmlFor="group-expense-search">Texto</label><input id="group-expense-search" value={expenseText} onChange={(event) => setExpenseText(event.target.value)} placeholder="Buscar" /><label htmlFor="group-expense-category">Categoria</label><select id="group-expense-category" value={expenseCategoryId} onChange={(event) => setExpenseCategoryId(event.target.value)}><option value="">Todas</option>{categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><label htmlFor="group-expense-tag">Etiqueta</label><select id="group-expense-tag" value={expenseTagId} onChange={(event) => setExpenseTagId(event.target.value)}><option value="">Todas</option>{tags.data?.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>{canManage && <><label htmlFor="new-group-tag">Nueva etiqueta</label><input id="new-group-tag" value={newGroupTag} onChange={(event) => setNewGroupTag(event.target.value)} maxLength={50} /><Button type="button" variant="tertiary" onPress={() => createGroupTag.mutate()} isDisabled={createGroupTag.isPending || !newGroupTag.trim()}>Crear etiqueta</Button></>}</div></div>
      {expenses.isPending && <p className="muted">Cargando gastos…</p>}
      {expenses.isError && <ErrorMessage error={expenses.error} />}
      {!expenses.isPending && !expenses.isError && eventExpenses.length === 0 && (
        <StatusPanel title="Este evento no tiene gastos">
          <p>
            {canAddExpense
              ? 'Registra el primer gasto cuando ocurra.'
              : 'El evento cerró sin gastos visibles.'}
          </p>
        </StatusPanel>
      )}
      {eventExpenses.length > 0 && (
        <div className="event-list">
          {eventExpenses.map((expense) => (
            <Link
              className="event-row glass-panel expense-link"
              to={`/app/groups/${groupId}/expenses/${expense.id}`}
              key={expense.id}
            >
              <Icon name="receipt" />
              <div>
                <h2>{expense.title}</h2>
                <p>
                  {expense.participantCount} participantes · {expense.splitMode}
                </p>
              </div>
              <strong>{formatMoney(expense.totalCents, expense.currency)}</strong>
            </Link>
          ))}
        </div>
      )}
      <Link className="button quiet" to={`/app/groups/${groupId}/events`}>
        Volver a eventos
      </Link>
    </PageHeader>
  );
}

function EventFundsPanel({ groupId, eventId, canManage, linked, available, isLoading, onSaved }: { groupId: string; eventId: string; canManage: boolean; linked: Array<{ fundId: string; name: string; currency: string; balanceCents: number; contributionsCents: number; movementCount: number }>; available: Array<{ id: string; name: string; archivedAt: string | null }>; isLoading: boolean; onSaved: () => void }) {
  const [selected, setSelected] = useState<string[]>(linked.map((fund) => fund.fundId));
  useEffect(() => setSelected(linked.map((fund) => fund.fundId)), [linked]);
  const update = useMutation({ mutationFn: () => cabalesApi.replaceEventFunds(groupId, eventId, selected), onSuccess: onSaved });
  return <section className="members-card glass-panel" aria-labelledby="event-funds-title"><h2 id="event-funds-title">Fondos vinculados</h2>{isLoading ? <p className="muted">Cargando saldos…</p> : linked.length === 0 ? <p className="muted">Este evento todavía no tiene fondos asociados.</p> : <ul className="fund-event-list">{linked.map((fund) => <li key={fund.fundId}><span><strong>{fund.name}</strong><small>{fund.movementCount} movimientos · aportes {formatMoney(fund.contributionsCents, fund.currency)}</small></span><strong>{formatMoney(fund.balanceCents, fund.currency)}</strong></li>)}</ul>}{canManage && available.length > 0 && <><fieldset><legend>Asociar fondos del grupo</legend><div className="participant-list">{available.filter((fund) => !fund.archivedAt).map((fund) => <label className="participant" key={fund.id}><span>{fund.name}</span><input type="checkbox" checked={selected.includes(fund.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, fund.id] : current.filter((id) => id !== fund.id))} /></label>)}</div></fieldset><Button variant="primary" type="button" isDisabled={update.isPending} onPress={() => update.mutate()}>{update.isPending ? 'Guardando…' : 'Guardar fondos'}</Button>{update.isError && <ErrorMessage error={update.error} />}</>}</section>;
}

function EventActions({
  canManage,
  groupId,
  eventId,
  cancelled,
  onCancelled,
  onDeleted,
}: {
  canManage: boolean;
  groupId: string;
  eventId: string;
  cancelled: boolean;
  onCancelled: (event: Awaited<ReturnType<typeof cabalesApi.cancelEvent>>) => void;
  onDeleted: () => void;
}) {
  const cancelMutation = useMutation({
    mutationFn: () => cabalesApi.cancelEvent(groupId, eventId),
    onSuccess: onCancelled,
  });
  const deleteMutation = useMutation({
    mutationFn: () => cabalesApi.deleteEvent(groupId, eventId),
    onSuccess: onDeleted,
  });
  if (!canManage) return null;
  return (
    <section className="button-row event-danger-actions" aria-label="Acciones del evento">
      {!cancelled && (
        <Button
          variant="tertiary"
          type="button"
          isDisabled={cancelMutation.isPending}
          onPress={() => window.confirm('¿Cancelar este evento?') && cancelMutation.mutate()}
        >
          Cancelar evento
        </Button>
      )}
      <Button
        variant="tertiary"
        type="button"
        isDisabled={deleteMutation.isPending}
        onPress={() =>
          window.confirm(
            '¿Eliminar este evento? Solo se puede si no tiene gastos ni liquidación.',
          ) && deleteMutation.mutate()
        }
      >
        Eliminar evento
      </Button>
      {(cancelMutation.isError || deleteMutation.isError) && (
        <ErrorMessage error={cancelMutation.error || deleteMutation.error} />
      )}
    </section>
  );
}

function formatReminder(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} día${minutes === 1440 ? '' : 's'} antes`;
  if (minutes % 60 === 0) return `${minutes / 60} hora${minutes === 60 ? '' : 's'} antes`;
  return `${minutes} minutos antes`;
}

function eventStatusLabel(status: 'OPEN' | 'CLOSED' | 'CANCELLED'): string {
  if (status === 'OPEN') return 'Evento abierto';
  if (status === 'CLOSED') return 'Evento cerrado';
  return 'Evento cancelado';
}
