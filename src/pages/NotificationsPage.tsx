import { Button } from '@heroui/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import type {
  Notification,
  NotificationPreferences,
  NotificationType,
} from '../api/module-schemas';
import { modulesApi } from '../api/modules-api';
import { ErrorMessage, ErrorState, formatDate, LoadingState, StatusPanel } from '../components/ui';
import {
  applicationServerKey,
  getNotificationPermission,
  getPushCapability,
  permissionState,
  subscriptionPayload,
  type PushPermissionState,
} from '../push/push';
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
  'document.expiring': 'Documentos por vencer',
  'document.expired': 'Documentos vencidos',
  'achievement.unlocked': 'Logros',
  'event.reminder': 'Recordatorios de eventos',
  'recurring.expense': 'Gastos recurrentes',
  'fund.contribution_due': 'Aportes próximos a vencer',
  'fund.contribution_overdue': 'Aportes vencidos',
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
  if (notification.type === 'event.reminder' && groupId && value('eventId'))
    return `/app/groups/${groupId}/events/${value('eventId')}`;
  if (
    (notification.type === 'fund.contribution_due' ||
      notification.type === 'fund.contribution_overdue') &&
    groupId &&
    value('fundId')
  )
    return `/app/groups/${groupId}/funds/${value('fundId')}`;
  return undefined;
}

function pushStateLabel(state: PushPermissionState): string {
  return {
    disabled: 'deshabilitado',
    unsupported: 'no compatible',
    'permission-not-requested': 'permiso no solicitado',
    denied: 'permiso denegado',
    'not-subscribed': 'no activado',
    enabled: 'activado',
  }[state];
}

/** Configuración de Web Push: pedir permiso solo desde el botón visible. */
function PushSettings() {
  const capability = getPushCapability();
  const config = useQuery(moduleQueries.pushConfig());
  const [state, setState] = useState<PushPermissionState>('permission-not-requested');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [retryAction, setRetryAction] = useState<'activate' | 'deactivate' | null>(null);
  const subscriptionRef = useRef<PushSubscription | null>(null);
  const endpointRef = useRef<string | undefined>(undefined);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if (config.isPending) return;
      if (config.isError) return;
      if (!config.data?.enabled) {
        setState('disabled');
        return;
      }
      if (!capability.supported) {
        setState('unsupported');
        return;
      }
      const permission = getNotificationPermission();
      if (permission === 'denied') return setState('denied');
      if (permission !== 'granted') return setState(permissionState());
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        subscriptionRef.current = subscription;
        endpointRef.current = subscription?.endpoint;
        setState(subscription ? 'enabled' : 'not-subscribed');
      } catch {
        if (!cancelled) {
          setError(new Error('No pudimos consultar el estado de las notificaciones.'));
          setRetryAction('activate');
        }
      }
    };
    void sync();
    return () => {
      cancelled = true;
    };
  }, [capability.supported, config.data, config.isError, config.isPending]);

  const activate = async () => {
    if (!config.data?.enabled || !config.data.publicKey || !capability.supported) return;
    setBusy(true);
    setError(undefined);
    setRetryAction(null);
    let createdSubscription: PushSubscription | null = null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'permission-not-requested');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      let subscription = existing;
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(config.data.publicKey),
        });
        createdSubscription = subscription;
      }
      await modulesApi.createPushSubscription(subscriptionPayload(subscription));
      subscriptionRef.current = subscription;
      endpointRef.current = subscription.endpoint;
      setState('enabled');
    } catch (cause) {
      if (createdSubscription) {
        try {
          const registration = await navigator.serviceWorker.ready.catch(() => undefined);
          const current = await registration?.pushManager.getSubscription();
          if (current?.endpoint === createdSubscription.endpoint) await current.unsubscribe();
        } catch {
          // La suscripción fallida no debe ocultar el error original de activación.
        }
      }
      setError(cause);
      setRetryAction('activate');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setError(undefined);
    setRetryAction(null);
    try {
      let subscription = subscriptionRef.current;
      if (!subscription) {
        const registration = await navigator.serviceWorker.ready;
        subscription = await registration.pushManager.getSubscription();
      }
      const endpoint = subscription?.endpoint ?? endpointRef.current;
      if (subscription) await subscription.unsubscribe();
      if (endpoint) await modulesApi.deletePushSubscription(endpoint);
      subscriptionRef.current = null;
      endpointRef.current = undefined;
      setState('not-subscribed');
    } catch (cause) {
      setError(cause);
      setRetryAction('deactivate');
    } finally {
      setBusy(false);
    }
  };

  let description = '';
  if (config.isPending) description = 'Comprobando disponibilidad…';
  else if (config.isError) description = 'No pudimos consultar la configuración push.';
  else if (!config.data?.enabled)
    description =
      'Las notificaciones push están deshabilitadas en este servidor. Los avisos siguen dentro de la app.';
  else if (!config.data.publicKey)
    description =
      'El servidor anunció push, pero no entregó una clave pública válida. Intenta más tarde.';
  else if (capability.reason === 'ios-install')
    description =
      'En iPhone o iPad, instala Cabales como app desde Safari para activar avisos push.';
  else if (capability.reason === 'secure-context')
    description = 'Los avisos push requieren una conexión segura (HTTPS).';
  else if (state === 'denied')
    description =
      'El permiso está denegado. Para reactivarlo, abre los ajustes del sitio en tu navegador, permite Notificaciones y vuelve a pulsar Activar.';
  else if (state === 'enabled')
    description = 'Recibirás avisos importantes aunque no tengas Cabales abierto.';
  else description = 'Los avisos también seguirán disponibles dentro de la app.';

  const canActivate = Boolean(
    config.data?.enabled && config.data.publicKey && capability.supported && state !== 'enabled',
  );
  const canDeactivate = state === 'enabled';
  return (
    <section className="push-settings glass-panel" aria-labelledby="push-title">
      <div>
        <h2 id="push-title">Avisos push</h2>
        <p id="push-description" className="muted small">
          {description}
        </p>
      </div>
      <p className="push-state" aria-live="polite" aria-busy={busy}>
        Estado: <strong>{config.isPending ? 'comprobando' : pushStateLabel(state)}</strong>
      </p>
      {config.isError && (
        <div className="push-actions">
          <ErrorMessage error={config.error} />
          <Button variant="tertiary" type="button" onPress={() => void config.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {Boolean(error) && (
        <div ref={errorRef} className="push-actions" tabIndex={-1}>
          <ErrorMessage error={error} />
          <Button
            variant="tertiary"
            type="button"
            isDisabled={busy}
            onPress={() => void (retryAction === 'deactivate' ? deactivate() : activate())}
          >
            Reintentar
          </Button>
        </div>
      )}
      <div className="push-actions">
        {canActivate && (
          <Button
            variant="primary"
            type="button"
            aria-describedby="push-description"
            isDisabled={busy}
            onPress={() => void activate()}
          >
            {busy ? 'Activando…' : 'Activar avisos push'}
          </Button>
        )}
        {canDeactivate && (
          <Button
            variant="tertiary"
            type="button"
            aria-describedby="push-description"
            isDisabled={busy}
            onPress={() => void deactivate()}
          >
            {busy ? 'Desactivando…' : 'Desactivar avisos push'}
          </Button>
        )}
      </div>
    </section>
  );
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
              <th scope="col">Push</th>
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
                    aria-label={`${typeLabel[item.type]} como aviso push`}
                    checked={item.push}
                    disabled={save.isPending || !channels.push}
                    onChange={(event) => toggle(item.type, 'push', event.target.checked)}
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
      {showPreferences && (
        <>
          <PushSettings />
          <Preferences />
        </>
      )}
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
