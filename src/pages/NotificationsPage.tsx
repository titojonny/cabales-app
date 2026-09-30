import { Button } from '@heroui/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import type {
  Notification,
  NotificationPreferences,
  NotificationType,
} from '../api/module-schemas';
import { modulesApi } from '../api/modules-api';
import { ErrorMessage, ErrorState, formatDate, LoadingState, StatusPanel } from '../components/ui';
import { PageHeader } from './GroupPages';

const typeLabel: Record<NotificationType, string> = {
  'invitation.received': 'Invitaciones recibidas',
  'invitation.accepted': 'Invitaciones aceptadas',
  'settlement.created': 'Cierres de eventos',
  'transfer.paid': 'Pagos registrados',
  'budget.threshold': 'Alertas de presupuesto',
  'fund.movement': 'Movimientos de fondos',
  'ocr.finished': 'Lectura de comprobantes',
  'privacy.updated': 'Solicitudes de privacidad',
  'achievement.unlocked': 'Logros',
};

/** Destino interno de un aviso; solo rutas propias, nunca URLs recibidas. */
function notificationLink(notification: Notification): string | undefined {
  const data = notification.data ?? {};
  const value = (key: string) =>
    typeof data[key] === 'string' ? (data[key] as string) : undefined;
  const groupId = value('groupId');
  if (notification.type === 'budget.threshold' && groupId) return `/app/groups/${groupId}/budgets`;
  if (notification.type === 'fund.movement' && groupId && value('fundId'))
    return `/app/groups/${groupId}/funds/${value('fundId')}`;
  if (
    (notification.type === 'settlement.created' || notification.type === 'transfer.paid') &&
    groupId
  )
    return value('settlementId')
      ? `/app/groups/${groupId}/settlements/${value('settlementId')}`
      : `/app/groups/${groupId}/settlements`;
  if (notification.type === 'invitation.accepted' && groupId) return `/app/groups/${groupId}`;
  if (notification.type === 'ocr.finished') return '/app/docs';
  if (notification.type === 'privacy.updated') return '/app/mas#privacidad';
  if (notification.type === 'achievement.unlocked') return '/app/achievements';
  return undefined;
}

function Preferences() {
  const queryClient = useQueryClient();
  const preferences = useQuery(moduleQueries.notificationPreferences());
  const save = useMutation({
    mutationFn: (next: NotificationPreferences['preferences']) =>
      modulesApi.updateNotificationPreferences(next),
    onSuccess: (data) => queryClient.setQueryData(moduleKeys.notificationPreferences, data),
  });
  if (preferences.isPending) return <p aria-busy="true">Cargando preferencias…</p>;
  if (preferences.isError) return <ErrorMessage error={preferences.error} />;
  const { channels } = preferences.data;
  const toggle = (type: NotificationType, channel: 'inApp' | 'email' | 'push', checked: boolean) =>
    save.mutate(
      preferences.data.preferences.map((item) =>
        item.type === type ? { ...item, [channel]: checked } : item,
      ),
    );
  return (
    <section className="form-card glass-panel preferences">
      <h2>Preferencias</h2>
      <p className="muted small">
        {channels.push
          ? 'Elige cómo quieres enterarte de cada tipo de aviso.'
          : 'Las notificaciones push aún no están disponibles; los avisos siempre quedan aquí.'}
        {!channels.email && ' El envío por correo no está configurado.'}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Aviso</th>
              <th scope="col">En la app</th>
              <th scope="col">Correo</th>
            </tr>
          </thead>
          <tbody>
            {preferences.data.preferences.map((item) => (
              <tr key={item.type}>
                <th scope="row">{typeLabel[item.type]}</th>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${typeLabel[item.type]} en la app`}
                    checked={item.inApp}
                    disabled={save.isPending}
                    onChange={(event) => toggle(item.type, 'inApp', event.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${typeLabel[item.type]} por correo`}
                    checked={item.email}
                    disabled={save.isPending || !channels.email}
                    onChange={(event) => toggle(item.type, 'email', event.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {save.isError && <ErrorMessage error={save.error} />}
    </section>
  );
}

/** Centro de avisos con lectura, archivo y preferencias por tipo. */
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'ACTIVE' | 'UNREAD' | 'ARCHIVED'>('ACTIVE');
  const [showPreferences, setShowPreferences] = useState(false);
  const list = useInfiniteQuery({
    queryKey: moduleKeys.notifications(status),
    queryFn: ({ pageParam }) => modulesApi.notifications(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: moduleKeys.notificationsRoot });
  const read = useMutation({ mutationFn: modulesApi.readNotification, onSuccess: refresh });
  const archive = useMutation({ mutationFn: modulesApi.archiveNotification, onSuccess: refresh });
  const readAll = useMutation({ mutationFn: modulesApi.readAllNotifications, onSuccess: refresh });
  const rows = list.data?.pages.flatMap((page) => page.data) ?? [];
  const mutationError = read.error ?? archive.error ?? readAll.error;

  return (
    <PageHeader
      eyebrow="Avisos"
      title="Lo que pasó en tus grupos"
      action={
        <div className="button-row">
          <Button
            variant="tertiary"
            type="button"
            isDisabled={readAll.isPending}
            onPress={() => readAll.mutate()}
          >
            Marcar todo como leído
          </Button>
          <Button
            variant="tertiary"
            type="button"
            aria-expanded={showPreferences}
            onPress={() => setShowPreferences((value) => !value)}
          >
            Preferencias
          </Button>
        </div>
      }
    >
      {showPreferences && <Preferences />}
      <div className="segmented" role="radiogroup" aria-label="Filtrar avisos">
        {(
          [
            ['ACTIVE', 'Recientes'],
            ['UNREAD', 'Sin leer'],
            ['ARCHIVED', 'Archivados'],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="notification-status"
              value={value}
              checked={status === value}
              onChange={() => setStatus(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {mutationError && <ErrorMessage error={mutationError} />}
      {list.isPending && <LoadingState title="Cargando avisos" />}
      {list.isError && (
        <ErrorState
          title="No pudimos cargar los avisos"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      )}
      {!list.isPending && !list.isError && rows.length === 0 && (
        <StatusPanel title="Sin avisos">
          <p>
            {status === 'ARCHIVED'
              ? 'No has archivado avisos.'
              : 'Aquí verás invitaciones, cierres, pagos y alertas.'}
          </p>
        </StatusPanel>
      )}
      {rows.length > 0 && (
        <ul className="notification-list">
          {rows.map((notification) => {
            const link = notificationLink(notification);
            const unread = notification.status === 'UNREAD';
            return (
              <li key={notification.id} className={`glass-panel ${unread ? 'unread' : ''}`}>
                <span className="grow">
                  <strong>
                    {unread && <span className="sr-only">Sin leer: </span>}
                    {link ? (
                      <Link to={link} onClick={() => unread && read.mutate(notification.id)}>
                        {notification.title}
                      </Link>
                    ) : (
                      notification.title
                    )}
                  </strong>
                  <span>{notification.body}</span>
                  <small>{formatDate(notification.createdAt, true)}</small>
                </span>
                <span className="row-actions">
                  {unread && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      type="button"
                      onPress={() => read.mutate(notification.id)}
                      aria-label={`Marcar como leído: ${notification.title}`}
                    >
                      Leído
                    </Button>
                  )}
                  {notification.status !== 'ARCHIVED' && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      type="button"
                      onPress={() => archive.mutate(notification.id)}
                      aria-label={`Archivar: ${notification.title}`}
                    >
                      Archivar
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {list.hasNextPage && (
        <Button
          variant="tertiary"
          type="button"
          isDisabled={list.isFetchingNextPage}
          onPress={() => void list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
        </Button>
      )}
    </PageHeader>
  );
}
