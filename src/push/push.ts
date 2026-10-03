export type PushPermissionState =
  'disabled' | 'unsupported' | 'permission-not-requested' | 'denied' | 'not-subscribed' | 'enabled';

export interface PushCapability {
  supported: boolean;
  reason?: 'ios-install' | 'secure-context' | 'browser';
}

type PushNavigator = Navigator & {
  standalone?: boolean;
};

type PushWindow = Window & {
  PushManager?: unknown;
  Notification?: { permission: NotificationPermission };
};

function browserWindow(): PushWindow {
  return globalThis as unknown as PushWindow;
}

function isIosDevice(navigator_: PushNavigator): boolean {
  return (
    /iPad|iPhone|iPod/i.test(navigator_.userAgent) ||
    (navigator_.platform === 'MacIntel' && navigator_.maxTouchPoints > 1)
  );
}

function isStandalone(navigator_: PushNavigator, window_: PushWindow): boolean {
  return (
    navigator_.standalone === true ||
    window_.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

/** Detecta Web Push y limita iOS al modo app instalada, donde el navegador lo permite. */
export function getPushCapability(): PushCapability {
  const window_ = browserWindow();
  const navigator_ = window_.navigator as PushNavigator | undefined;
  if (!navigator_ || !window_.Notification || !window_.PushManager || !navigator_.serviceWorker)
    return { supported: false, reason: 'browser' };
  if (isIosDevice(navigator_) && !isStandalone(navigator_, window_))
    return { supported: false, reason: 'ios-install' };
  if (window_.isSecureContext === false && !['localhost', '127.0.0.1'].includes(location.hostname))
    return { supported: false, reason: 'secure-context' };
  return { supported: true };
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  return browserWindow().Notification?.permission ?? 'unsupported';
}

export function permissionState(subscribed = false): PushPermissionState {
  const permission = getNotificationPermission();
  if (permission === 'unsupported') return 'unsupported';
  if (permission === 'denied') return 'denied';
  if (permission === 'default') return 'permission-not-requested';
  return subscribed ? 'enabled' : 'not-subscribed';
}

/** Convierte la clave VAPID pública base64url al formato requerido por PushManager. */
export function applicationServerKey(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
}

export function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
    throw new Error('El navegador devolvió una suscripción incompleta.');
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}
