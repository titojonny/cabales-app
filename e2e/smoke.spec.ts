import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/config', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { googleEnabled: false } }),
    }),
  );
  await page.route('**/api/v1/auth/me', async (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'SESSION_INVALID', message: 'Sesion invalida' },
      }),
    }),
  );
});

test('la entrada pública presenta Cabales y permite ir al acceso', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /cuentas claras/i })).toBeVisible();
  await page
    .getByRole('link', { name: /iniciar sesión/i })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /vuelve a tus cuentas/i })).toBeVisible();
});

test('el registro aplica la política real de contraseña antes de llamar a la API', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Nombre').fill('Ana');
  await page.getByLabel('Correo').fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('corta123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('La contraseña debe tener al menos 12 caracteres.')).toBeVisible();
});

test('conserva el token de invitación al exigir inicio de sesión', async ({ page }) => {
  const token = 'opaque-invitation-token-123456789';
  // Cualquier otra llamada del shell (p. ej. contador de avisos) responde vacío.
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: pathname.endsWith('/auth/config') ? { googleEnabled: false } : { unread: 0 },
      }),
    });
  });
  await page.route('**/api/v1/groups/invitations/preview', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          groupName: 'Viaje a la playa',
          invitedBy: 'Bea',
          role: 'MEMBER',
          status: 'PENDING',
          expiresAt: '2099-01-01T00:00:00.000Z',
          emailMatches: true,
        },
      }),
    }),
  );
  await page.route('**/api/v1/auth/me', async (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'SESSION_INVALID', message: 'Sesión inválida' },
      }),
    }),
  );
  await page.route('**/api/v1/auth/login', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'ana@example.com',
            displayName: 'Ana',
            avatarUrl: null,
            locale: 'es',
            emailVerified: true,
          },
          csrfToken: 'csrf-token-from-login-123456',
        },
      }),
    }),
  );

  await page.goto(`/app/invitations/accept#token=${token}`);
  await page.getByLabel('Correo').fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('password-secure-123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByText('Viaje a la playa')).toBeVisible();
  // El token no debe quedar en la barra de direcciones ni en el historial.
  await expect(page).toHaveURL(/\/app\/invitations\/accept$/);
});

test('la recuperación de contraseña envía la solicitud y no revela si la cuenta existe', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/me', async (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'SESSION_INVALID', message: 'Sesión inválida' },
      }),
    }),
  );
  await page.route('**/api/v1/auth/password-recovery/request', async (route) =>
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { accepted: true } }),
    }),
  );
  await page.goto('/forgot-password');
  await page.getByLabel('Correo').fill('nadie@example.com');
  await page.getByRole('button', { name: /enviar/i }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
});
