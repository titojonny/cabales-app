import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { queries, queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { ErrorMessage, Icon, StatusPanel } from '../components/ui';
import { formatMoney } from '../domain/money';
import { fallbackParticipantLabel, participantLabelMap } from '../domain/participants';
import { PageHeader } from './GroupPages';

interface SettlementAttempt {
  eventId: string;
  idempotencyKey: string;
}

/** Selecciona un evento abierto y lista los cierres reales devueltos por la API. */
export function SettlementPage() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const settlements = useQuery(queries.settlements(groupId));
  const events = useQuery(queries.events(groupId));
  const [eventId, setEventId] = useState('');
  const openEvents = (events.data ?? []).filter(
    (event) => event.status === 'OPEN' && !event.settlement,
  );
  const canManage = ['OWNER', 'ADMIN'].includes(group.data?.currentRole ?? '');
  const generate = useMutation({
    mutationFn: (attempt: SettlementAttempt) =>
      cabalesApi.createSettlement(groupId, attempt.eventId, attempt.idempotencyKey),
    retry: 1,
    onSuccess: (settlement) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settlements(groupId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
      navigate(`/app/groups/${groupId}/settlements/${settlement.id}`);
    },
  });

  const createSettlement = () => {
    if (!eventId) return;
    generate.mutate({ eventId, idempotencyKey: crypto.randomUUID() });
  };

  return (
    <PageHeader eyebrow="Cierre del grupo" title="Liquidaciones">
      <GroupTabs groupId={groupId} />
      {canManage ? (
        <section className="form-card glass-panel settlement-create">
          <label htmlFor="settlement-event">Evento abierto a cerrar</label>
          <select
            id="settlement-event"
            value={eventId}
            onChange={(change) => setEventId(change.target.value)}
            disabled={events.isPending || openEvents.length === 0}
          >
            <option value="">Selecciona un evento</option>
            {openEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} · {event.expenseCount ?? 0} gastos
              </option>
            ))}
          </select>
          <button
            className="button primary"
            type="button"
            onClick={createSettlement}
            disabled={!eventId || generate.isPending}
          >
            <Icon name="transfer" />
            {generate.isPending ? 'Calculando…' : 'Cerrar evento seleccionado'}
          </button>
          {events.isError && <ErrorMessage error={events.error} />}
          {!events.isPending && !events.isError && openEvents.length === 0 && (
            <p className="muted">No hay eventos abiertos disponibles para liquidar.</p>
          )}
          {generate.isError && <ErrorMessage error={generate.error} />}
        </section>
      ) : (
        !group.isPending && (
          <p className="muted" role="status">
            Solo OWNER o ADMIN puede cerrar eventos. Las liquidaciones siguen disponibles para
            consulta.
          </p>
        )
      )}

      {settlements.isPending && (
        <StatusPanel title="Cargando cierres">
          <p>Consultando liquidaciones anteriores…</p>
        </StatusPanel>
      )}
      {settlements.isError && (
        <StatusPanel title="No pudimos cargar las liquidaciones">
          <ErrorMessage error={settlements.error} />
        </StatusPanel>
      )}
      {settlements.data?.length === 0 && (
        <StatusPanel title="Todavía no hay cierres">
          <p>Selecciona un evento abierto con gastos para crear su plan de transferencias.</p>
        </StatusPanel>
      )}
      {settlements.data && settlements.data.length > 0 && (
        <div className="settlement-list">
          {settlements.data.map((settlement) => {
            const eventName = events.data?.find((event) => event.id === settlement.eventId)?.name;
            return (
              <article className="settlement-row glass-panel" key={settlement.id}>
                <Icon name="transfer" />
                <div>
                  <span>Evento</span>
                  <strong>{eventName || `Evento ${settlement.eventId.slice(0, 8)}`}</strong>
                </div>
                <strong className="settlement-amount">
                  {settlement.transferCount}{' '}
                  {settlement.transferCount === 1 ? 'transferencia' : 'transferencias'}
                </strong>
                <span className={`status-chip ${settlementStatusClass(settlement.status)}`}>
                  {settlementStatusLabel(settlement.status)}
                </span>
                <Link
                  className="button quiet"
                  to={`/app/groups/${groupId}/settlements/${settlement.id}`}
                >
                  Ver detalle
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </PageHeader>
  );
}

/** Presenta transferencias de un cierre y usa únicamente el endpoint real para marcar pagos. */
export function SettlementDetailPage() {
  const { groupId = '', settlementId = '' } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const settlement = useQuery(queries.settlement(groupId, settlementId));
  const eventId = settlement.data?.eventId ?? '';
  const event = useQuery({ ...queries.event(groupId, eventId), enabled: Boolean(eventId) });
  const markPaid = useMutation({
    mutationFn: (transferId: string) =>
      cabalesApi.markTransferPaid(groupId, settlementId, transferId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settlement(groupId, settlementId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settlements(groupId) });
    },
  });

  if (settlement.isPending)
    return (
      <StatusPanel title="Cargando liquidación">
        <p>Consultando transferencias e historial…</p>
      </StatusPanel>
    );
  if (settlement.isError)
    return (
      <StatusPanel title="No pudimos abrir la liquidación">
        <ErrorMessage error={settlement.error} />
      </StatusPanel>
    );

  const labels = participantLabelMap(event.data?.participants);
  const privileged = ['OWNER', 'ADMIN'].includes(group.data?.currentRole ?? '');
  const labelFor = (participantId: string, guestName?: string) =>
    labels.get(participantId) || fallbackParticipantLabel(participantId, guestName);

  return (
    <PageHeader
      eyebrow={settlementStatusLabel(settlement.data.status)}
      title={event.data?.name || `Liquidación ${settlement.data.id.slice(0, 8)}`}
    >
      <GroupTabs groupId={groupId} />
      {markPaid.isError && <ErrorMessage error={markPaid.error} />}
      {markPaid.isSuccess && (
        <p className="success-message" role="status">
          Transferencia marcada como pagada. Los saldos se actualizaron.
        </p>
      )}
      {settlement.data.transfers.length === 0 ? (
        <StatusPanel title="Sin transferencias necesarias">
          <p>El evento quedó balanceado y la liquidación se completó sin movimientos.</p>
        </StatusPanel>
      ) : (
        <div className="settlement-list">
          {settlement.data.transfers.map((transfer) => {
            const canMarkPaid =
              privileged || transfer.debtor.groupMemberId === group.data?.currentMemberId;
            return (
              <article className="settlement-row glass-panel" key={transfer.id}>
                <Icon name="transfer" />
                <div>
                  <span>
                    {labelFor(transfer.debtorParticipantId, transfer.debtor.guestName)} paga a
                  </span>
                  <strong>
                    {labelFor(transfer.creditorParticipantId, transfer.creditor.guestName)}
                  </strong>
                </div>
                <strong className="settlement-amount">
                  {formatMoney(transfer.amountCents, settlement.data.currency)}
                </strong>
                <span className={`status-chip ${transferStatusClass(transfer.status)}`}>
                  {transferStatusLabel(transfer.status)}
                </span>
                {transfer.status === 'PENDING' && canMarkPaid && (
                  <button
                    className="button quiet"
                    type="button"
                    disabled={markPaid.isPending}
                    onClick={() => markPaid.mutate(transfer.id)}
                  >
                    <Icon name="check" />
                    Marcar pagada
                  </button>
                )}
                <details className="transfer-history">
                  <summary>Historial ({transfer.history.length})</summary>
                  <ul>
                    {transfer.history.map((entry, index) => (
                      <li key={`${entry.createdAt}-${index}`}>
                        {entry.fromStatus ? `${transferStatusLabel(entry.fromStatus)} → ` : ''}
                        {transferStatusLabel(entry.toStatus)} ·{' '}
                        {new Date(entry.createdAt).toLocaleString('es')}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            );
          })}
        </div>
      )}
      {event.isError && (
        <p className="muted" role="status">
          No se pudieron recuperar nombres registrados; se muestran identificadores honestos.
        </p>
      )}
      <Link className="button quiet" to={`/app/groups/${groupId}/settlements`}>
        Volver a liquidaciones
      </Link>
    </PageHeader>
  );
}

function settlementStatusLabel(status: 'OPEN' | 'COMPLETED' | 'CANCELLED'): string {
  if (status === 'OPEN') return 'Abierta';
  if (status === 'COMPLETED') return 'Completada';
  return 'Cancelada';
}

function settlementStatusClass(status: 'OPEN' | 'COMPLETED' | 'CANCELLED'): string {
  if (status === 'OPEN') return 'pending';
  if (status === 'COMPLETED') return 'completed';
  return 'cancelled';
}

function transferStatusLabel(status: 'PENDING' | 'PAID' | 'DISPUTED' | 'CANCELLED'): string {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'PAID') return 'Pagada';
  if (status === 'DISPUTED') return 'En disputa';
  return 'Cancelada';
}

function transferStatusClass(status: 'PENDING' | 'PAID' | 'DISPUTED' | 'CANCELLED'): string {
  if (status === 'PENDING') return 'pending';
  if (status === 'PAID') return 'completed';
  return 'cancelled';
}

function GroupTabs({ groupId }: { groupId: string }) {
  return (
    <div className="tabs" role="tablist" aria-label="Secciones del grupo">
      <Link role="tab" aria-selected="false" to={`/app/groups/${groupId}`}>
        Resumen
      </Link>
      <Link role="tab" aria-selected="false" to={`/app/groups/${groupId}/events`}>
        Eventos
      </Link>
      <Link
        role="tab"
        aria-selected="true"
        className="active"
        to={`/app/groups/${groupId}/settlements`}
      >
        Liquidaciones
      </Link>
    </div>
  );
}
