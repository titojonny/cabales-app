import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPushCapability, permissionState } from './push';

function installPushGlobals(permission: NotificationPermission = 'default') {
  vi.stubGlobal('PushManager', class PushManager {});
  vi.stubGlobal('Notification', { permission });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: undefined,
  });
});

describe('estados de push', () => {
  it('detecta navegador no compatible', () => {
    expect(getPushCapability().supported).toBe(false);
    expect(permissionState()).toBe('unsupported');
  });

  it('distingue permiso no solicitado, denegado y activado', () => {
    installPushGlobals('default');
    expect(getPushCapability().supported).toBe(true);
    expect(permissionState()).toBe('permission-not-requested');

    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(permissionState()).toBe('denied');

    vi.stubGlobal('Notification', { permission: 'granted' });
    expect(permissionState(true)).toBe('enabled');
  });

  it('pide instalación en iOS antes de ofrecer push', () => {
    installPushGlobals();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    expect(getPushCapability()).toEqual({ supported: false, reason: 'ios-install' });
  });
});

