import { Button } from '@heroui/react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import type { CabudasTransfer } from '../api/module-schemas';
import { modulesApi } from '../api/modules-api';
import { ErrorMessage, ErrorState, formatDate, LoadingState, StatusPanel } from '../components/ui';
import { formatMoney } from '../domain/money';
import { PageHeader } from './GroupPages';

const statusLabel: Record<CabudasTransfer['status'], string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  DISPUTED: 'En disputa',
  CANCELLED: 'Cancelada',
};

function TransferRow({ transfer }: { transfer: CabudasTransfer }) {
  const paying = transfer.direction === 'PAY';
  return (
    <li className="glass-panel cabuda-row">
      <span className={`direction ${paying ? 'pay' : 'receive'}`}>
        {paying ? 'Pagas' : 'Recibes'}
      </span>
      <span className="grow">
        <strong>{transfer.counterparty.displayName}</strong>
        <small>
          {transfer.groupName} · {transfer.eventName} · {statusLabel[transfer.status]}
          {transfer.paidAt ? ` el ${formatDate(transfer.paidAt)}` : ''}
        </small>
      </span>
      <strong className={paying ? 'negative' : 'positive'}>
        {formatMoney(transfer.amountCents, transfer.currency)}
      </strong>
      {transfer.status === 'PENDING' && (
        <Link
          className="button quiet small"
          to={`/app/groups/${transfer.groupId}/settlements/${transfer.settlementId}`}
        >
          Ver cierre
        </Link>
      )}
    </li>
  );
}

/** Deudas consolidadas: cuánto debes y te deben por moneda, persona y grupo. */
export function CabudasPage() {
  const summary = useQuery(moduleQueries.cabudas());
  const [status, setStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('PAID');
  const history = useInfiniteQuery({
    queryKey: moduleKeys.cabudasHistory(status),
    queryFn: ({ pageParam }) => modulesApi.cabudasHistory({ status, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  if (summary.isPending) return <LoadingState title="Calculando Cabudas" />;
  if (summary.isError)
    return (
      <ErrorState
        title="No pudimos calcular tus deudas"
        error={summary.error}
        onRetry={() => void summary.refetch()}
      />
    );
  const data = summary.data;
  const empty =
    data.totals.length === 0 && data.openEvents.length === 0 && data.pendingTransfers.length === 0;
  const historyRows = history.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <PageHeader eyebrow="Cabudas" title="Tus cuentas pendientes">
      {empty ? (
        <StatusPanel
          title="Estás al día"
          action={
            <Link className="button primary" to="/app/groups">
              Ver grupos
            </Link>
          }
        >
          <p>No tienes transferencias pendientes ni eventos abiertos con saldo.</p>
        </StatusPanel>
      ) : (
        <>
          {data.totals.length > 0 && (
            <div className="summary-grid totals">
              {data.totals.map((total) => (
                <article className="metric-card" key={total.currency}>
                  <span>Balance en {total.currency}</span>
                  <strong className={total.netCents < 0 ? 'negative' : 'positive'}>
                    {formatMoney(total.netCents, total.currency)}
                  </strong>
                  <small>
                    Te deben {formatMoney(total.owedToMeCents, total.currency)} · Debes{' '}
                    {formatMoney(total.iOweCents, total.currency)}
                  </small>
                </article>
              ))}
            </div>
          )}

          {data.simplifiedTransfers.length > 0 && (
            <section className="list-section">
              <h2 className="section-title">Para quedar a mano</h2>
              <ul className="cabuda-list">
                {data.simplifiedTransfers.map((transfer, index) => (
                  <li
                    key={`${transfer.counterparty.displayName}-${transfer.currency}-${index}`}
                    className="glass-panel cabuda-row"
                  >
                    <span
                      className={`direction ${transfer.direction === 'PAY' ? 'pay' : 'receive'}`}
                    >
                      {transfer.direction === 'PAY' ? 'Paga a' : 'Cobra a'}
                    </span>
                    <span className="grow">
                      <strong>{transfer.counterparty.displayName}</strong>
                      {transfer.counterparty.isGuest && <small>Invitado sin cuenta</small>}
                    </span>
                    <strong className={transfer.direction === 'PAY' ? 'negative' : 'positive'}>
                      {formatMoney(transfer.amountCents, transfer.currency)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.groups.length > 0 && (
            <section className="list-section">
              <h2 className="section-title">Por grupo</h2>
              <ul className="cabuda-list">
                {data.groups.map((group) => (
                  <li key={`${group.groupId}-${group.currency}`} className="glass-panel cabuda-row">
                    <span className="grow">
                      <Link to={`/app/groups/${group.groupId}/settlements`}>
                        <strong>{group.groupName}</strong>
                      </Link>
                      <small>
                        Te deben {formatMoney(group.owedToMeCents, group.currency)} · Debes{' '}
                        {formatMoney(group.iOweCents, group.currency)}
                      </small>
                    </span>
                    <strong className={group.netCents < 0 ? 'negative' : 'positive'}>
                      {formatMoney(group.netCents, group.currency)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.pendingTransfers.length > 0 && (
            <section className="list-section">
              <h2 className="section-title">Transferencias pendientes</h2>
              <ul className="cabuda-list">
                {data.pendingTransfers.map((transfer) => (
                  <TransferRow key={transfer.transferId} transfer={transfer} />
                ))}
              </ul>
            </section>
          )}

          {data.openEvents.length > 0 && (
            <section className="list-section">
              <h2 className="section-title">Eventos sin cerrar</h2>
              <p className="muted small">
                Estimación de tu saldo en eventos abiertos; no es deuda hasta liquidar el evento.
              </p>
              <ul className="cabuda-list">
                {data.openEvents.map((event) => (
                  <li key={event.eventId} className="glass-panel cabuda-row">
                    <span className="grow">
                      <Link to={`/app/groups/${event.groupId}/events/${event.eventId}`}>
                        <strong>{event.eventName}</strong>
                      </Link>
                      <small>{event.groupName}</small>
                    </span>
                    <strong className={event.myNetCents > 0 ? 'negative' : 'positive'}>
                      {event.myNetCents > 0 ? 'Debes ' : event.myNetCents < 0 ? 'Te deben ' : ''}
                      {formatMoney(Math.abs(event.myNetCents), event.currency)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="list-section">
        <div className="section-heading">
          <h2 className="section-title">Historial</h2>
          <label htmlFor="history-status" className="sr-only">
            Filtrar historial
          </label>
          <select
            id="history-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="PAID">Pagadas</option>
            <option value="PENDING">Pendientes</option>
            <option value="ALL">Todas</option>
          </select>
        </div>
        {history.isPending && <p aria-busy="true">Cargando historial…</p>}
        {history.isError && <ErrorMessage error={history.error} />}
        {!history.isPending && historyRows.length === 0 && (
          <p className="muted">No hay transferencias en este filtro.</p>
        )}
        {historyRows.length > 0 && (
          <ul className="cabuda-list">
            {historyRows.map((transfer) => (
              <TransferRow key={transfer.transferId} transfer={transfer} />
            ))}
          </ul>
        )}
        {history.hasNextPage && (
          <Button
            variant="tertiary"
            type="button"
            isDisabled={history.isFetchingNextPage}
            onPress={() => void history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        )}
      </section>
    </PageHeader>
  );
}
