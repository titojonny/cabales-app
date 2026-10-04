import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { ErrorMessage, StatusPanel } from '../components/ui';
import { PageHeader } from './GroupPages';

/** Calendario mensual y agenda con controles de teclado nativos y datos de todos los grupos. */
export function CalendarPage() {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const from = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const to = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 1), [month]);
  const events = useQuery({
    queryKey: ['calendar-events', from.toISOString(), to.toISOString()],
    queryFn: () => cabalesApi.calendarEvents(from.toISOString(), to.toISOString()),
  });
  const days = useMemo(() => calendarDays(from), [from]);
  return (
    <PageHeader eyebrow="Organización" title="Calendario">
      <section className="calendar-toolbar glass-panel" aria-label="Cambiar mes">
        <button
          className="button quiet"
          type="button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          Mes anterior
        </button>
        <h2 aria-live="polite">
          {month.toLocaleDateString('es', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          className="button quiet"
          type="button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          Mes siguiente
        </button>
      </section>
      {events.isPending && (
        <StatusPanel title="Cargando calendario">
          <p>Consultando eventos de tus grupos…</p>
        </StatusPanel>
      )}
      {events.isError && (
        <StatusPanel title="No pudimos cargar el calendario">
          <ErrorMessage error={events.error} />
        </StatusPanel>
      )}
      {events.data && (
        <>
          <section className="calendar-grid glass-panel" aria-label="Vista mensual">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <strong key={day}>{day}</strong>
            ))}
            {days.map((day) => {
              const dayEvents = events.data.filter((event) =>
                sameDay(new Date(event.startsAt), day),
              );
              return (
                <div className="calendar-day" key={day.toISOString()}>
                  <time dateTime={day.toISOString()}>{day.getDate()}</time>
                  {dayEvents.map((event) => (
                    <Link
                      key={event.id}
                      className="calendar-event"
                      to={`/app/groups/${event.groupId}/events/${event.id}`}
                    >
                      {event.name}
                    </Link>
                  ))}
                </div>
              );
            })}
          </section>
          <section className="members-card glass-panel" aria-labelledby="agenda-title">
            <h2 id="agenda-title">Agenda</h2>
            {events.data.length === 0 ? (
              <p className="muted">No hay eventos este mes.</p>
            ) : (
              <ol className="agenda-list">
                {events.data.map((event) => (
                  <li key={event.id}>
                    <time dateTime={event.startsAt}>
                      {new Date(event.startsAt).toLocaleString('es', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    <Link to={`/app/groups/${event.groupId}/events/${event.id}`}>
                      <strong>{event.name}</strong>
                      <small>
                        {event.group.name}
                        {event.locationName ? ` · ${event.locationName}` : ''}
                      </small>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </PageHeader>
  );
}

function calendarDays(month: Date): Date[] {
  const first = new Date(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from(
    { length: 42 },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}
function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
