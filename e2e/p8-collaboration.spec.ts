import { expect, test } from '@playwright/test';
import responses from '../src/test/fixtures/api-responses.json' with { type: 'json' };

test.use({ serviceWorkers: 'block' });

const groupId = responses.group.id;
const eventId = responses.event.id;
const publicToken = 'A'.repeat(43);

test('renderiza un resumen publico sin correo ni identificadores internos', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Sesion requerida' },
        }),
      });
      return;
    }
    if (pathname === `/api/v1/share/summaries/${publicToken}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            type: 'SETTLEMENT',
            expiresAt: '2026-10-30T12:00:00.000Z',
            groupName: 'Viaje',
            eventName: 'Cena',
            status: 'COMPLETED',
            currency: 'USD',
            totalCents: 12000,
            participants: [{ displayName: 'Ana' }, { displayName: 'Luis' }],
            transfers: [{ debtor: 'Ana', creditor: 'Luis', amountCents: 3000, status: 'PENDING' }],
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No encontrado' },
      }),
    });
  });

  await page.goto(`/share/summaries/${publicToken}`);
  await expect(page.getByRole('heading', { name: 'Cena' })).toBeVisible();
  await expect(
    page
      .getByRole('heading', { name: 'Participantes' })
      .locator('..')
      .getByText('Ana', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('correo', { exact: false })).not.toBeVisible();
  await expect(page.getByText(publicToken)).not.toBeVisible();
});

test('ofrece calendario mensual y agenda navegables por teclado', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (pathname.endsWith('/auth/me')) data = responses.me;
    else if (pathname === '/api/v1/groups') data = [responses.group];
    else if (pathname === `/api/v1/calendar/events`)
      data = [
        {
          id: eventId,
          groupId,
          name: 'Noche de grupo',
          description: null,
          startsAt: '2026-10-15T18:00:00.000Z',
          endsAt: '2026-10-15T21:00:00.000Z',
          status: 'OPEN',
          locationName: 'Centro',
          group: { name: responses.group.name, currency: 'USD' },
        },
      ];
    else if (pathname.endsWith('/notifications/unread-count')) data = { unread: 0 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });

  await page.goto('/app/calendar');
  await expect(page.getByRole('heading', { name: 'Calendario', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Noche de grupo', exact: true })).toBeVisible();
  const next = page.getByRole('button', { name: 'Mes siguiente' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(next).toBeFocused();
});
