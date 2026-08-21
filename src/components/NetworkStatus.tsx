import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** Informa conectividad y actualizaciones sin prometer escrituras offline. */
export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
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
          <strong>Sin conexión.</strong> Puedes recorrer el shell ya cargado, pero no consultar ni
          guardar datos.
        </aside>
      )}
      {updateAvailable && (
        <aside className="network-banner update-banner">
          <span>Hay una versión nueva de Cabales.</span>
          <button type="button" onClick={() => void updateServiceWorker?.(true)}>
            Actualizar
          </button>
        </aside>
      )}
    </div>
  );
}
