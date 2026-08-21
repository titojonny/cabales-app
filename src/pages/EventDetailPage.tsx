import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { queries } from '../api/queries';
import { ErrorMessage, Icon, StatusPanel } from '../components/ui';
import { formatMoney } from '../domain/money';
import { participantLabel } from '../domain/participants';
import { PageHeader } from './GroupPages';

/** Reúne el padrón, enlaces y gastos filtrados del evento para mantenerlos alcanzables. */
export function EventDetailPage() {
  const { groupId = '', eventId = '' } = useParams();
  const event = useQuery(queries.event(groupId, eventId));
  const expenses = useQuery(queries.expenses(groupId));

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

  const eventExpenses = (expenses.data ?? []).filter((expense) => expense.eventId === eventId);
  const canAddExpense = event.data.status === 'OPEN' && !event.data.settlement;

  return (
    <PageHeader
      eyebrow={eventStatusLabel(event.data.status)}
      title={event.data.name}
      action={
        canAddExpense ? (
          <Link
            className="button primary"
            to={`/app/groups/${groupId}/events/${eventId}/expenses/new`}
          >
            <Icon name="plus" /> Añadir gasto
          </Link>
        ) : undefined
      }
    >
      <div className="summary-grid">
        <article className="members-card glass-panel">
          <h2>Participantes</h2>
          <ul>
            {(event.data.participants ?? []).map((participant) => (
              <li key={participant.id}>
                <span className="avatar" aria-hidden="true">
                  {participantLabel(participant).slice(0, 1).toUpperCase()}
                </span>
                <strong>{participantLabel(participant)}</strong>
              </li>
            ))}
          </ul>
        </article>
        <article className="members-card glass-panel event-links">
          <h2>Enlaces</h2>
          {event.data.links?.length ? (
            <ul>
              {event.data.links.map((link) => (
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
        </article>
      </div>
      <h2 className="section-title">Gastos</h2>
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

function eventStatusLabel(status: 'OPEN' | 'CLOSED' | 'CANCELLED'): string {
  if (status === 'OPEN') return 'Evento abierto';
  if (status === 'CLOSED') return 'Evento cerrado';
  return 'Evento cancelado';
}
