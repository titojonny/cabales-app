import { expect, test } from '@playwright/test';

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
  await page.getByLabel('Contraseña').fill('corta123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('La contraseña debe tener al menos 12 caracteres.')).toBeVisible();
});

test('conserva el token de invitación al exigir inicio de sesión', async ({ page }) => {
  const token = 'opaque-invitation-token-123456789';
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
          },
          csrfToken: 'csrf-token-from-login-123456',
        },
      }),
    }),
  );

  await page.goto(`/app/invitations/accept?token=${token}`);
  await page.getByLabel('Correo').fill('ana@example.com');
  await page.getByLabel('Contraseña').fill('password-secure-123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByLabel('Token de invitación')).toHaveValue(token);
});
