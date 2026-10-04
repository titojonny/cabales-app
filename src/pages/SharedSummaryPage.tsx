import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { ErrorMessage, StatusPanel } from '../components/ui';
import { formatMoney } from '../domain/money';

/** Resumen público mínimo: no requiere sesión y nunca muestra correos ni datos de cuenta. */
export function SharedSummaryPage() {
  const { token = '' } = useParams();
  const summary = useQuery({
    queryKey: ['public-summary', token],
    queryFn: () => cabalesApi.publicSummary(token),
    enabled: token.length > 0,
    retry: false,
  });
  if (summary.isPending)
    return (
      <StatusPanel title="Cargando resumen">
        <p>Validando el enlace compartido…</p>
      </StatusPanel>
    );
  if (summary.isError)
    return (
      <StatusPanel title="Este enlace no está disponible">
        <ErrorMessage error={summary.error} />
      </StatusPanel>
    );
  const data = summary.data;
  return (
    <main id="contenido" className="page public-summary" aria-labelledby="public-summary-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">Resumen compartido · solo lectura</p>
          <h1 id="public-summary-title">{data.eventName}</h1>
          <p className="muted">{data.groupName}</p>
        </div>
      </header>
      <section className="summary-grid">
        <article className="metric-card">
          <span>Total</span>
          <strong>{formatMoney(data.totalCents, data.currency)}</strong>
          <small>{data.type === 'SETTLEMENT' ? 'Liquidación' : 'Evento'}</small>
        </article>
        <article className="metric-card">
          <span>Personas</span>
          <strong>{data.participants.length}</strong>
          <small>Nombres visibles solo dentro de este resumen</small>
        </article>
        <article className="metric-card">
          <span>Estado</span>
          <strong>{publicStatus(data.status)}</strong>
          <small>Enlace válido hasta {new Date(data.expiresAt).toLocaleString('es')}</small>
        </article>
      </section>
      <section className="members-card glass-panel" aria-labelledby="transfers-title">
        <h2 id="transfers-title">Quién paga a quién</h2>
        {data.transfers.length === 0 ? (
          <p className="muted">No hay transferencias calculadas para este evento.</p>
        ) : (
          <ul className="settlement-list">
            {data.transfers.map((transfer, index) => (
              <li
                className="settlement-row"
                key={`${transfer.debtor}-${transfer.creditor}-${index}`}
              >
                <span>
                  <strong>{transfer.debtor}</strong> paga a <strong>{transfer.creditor}</strong>
                </span>
                <strong>{formatMoney(transfer.amountCents, data.currency)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="members-card glass-panel" aria-labelledby="participants-title">
        <h2 id="participants-title">Participantes</h2>
        <ul>
          {data.participants.map((participant, index) => (
            <li key={`${participant.displayName}-${index}`}>
              <span className="avatar" aria-hidden="true">
                {participant.displayName.slice(0, 1).toUpperCase()}
              </span>
              <strong>{participant.displayName}</strong>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function publicStatus(status: string): string {
  if (status === 'COMPLETED') return 'Completada';
  if (status === 'CLOSED') return 'Cerrado';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Abierto';
}
