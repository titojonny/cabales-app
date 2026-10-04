import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { registerSW } from 'virtual:pwa-register';
import { useOfflineCacheStatus } from '../api/offline-cache';

/** Informa conectividad y actualizaciones sin prometer escrituras offline. */
export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { lastUpdatedAt } = useOfflineCacheStatus();
  const [updateServiceWorker, setUpdateServiceWorker] = useState<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    const update = registerSW({ onNeedRefresh: () => setUpdateAvailable(true) });
    setUpdateServiceWorker(() => update);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div className="network-stack" aria-live="polite">
      {!online && (
        <aside className="network-banner">
          <strong>Sin conexión.</strong> Puedes consultar datos previamente cargados; las mutaciones
          están deshabilitadas y no se encolan pagos.
          {lastUpdatedAt && (
            <span>
              {' '}
              Última actualización local:{' '}
              {new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(
                lastUpdatedAt,
              )}
              .
            </span>
          )}
        </aside>
      )}
      {updateAvailable && (
        <aside className="network-banner update-banner">
          <span>Hay una versión nueva de Cabales.</span>
          <Button
            variant="secondary"
            type="button"
            onPress={() => void updateServiceWorker?.(true)}
          >
            Actualizar
          </Button>
        </aside>
      )}
    </div>
  );
}
