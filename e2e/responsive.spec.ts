import { expect, test, type Page } from '@playwright/test';
import responses from '../src/test/fixtures/api-responses.json' with { type: 'json' };

// El service worker de la PWA intercepta /api antes de que Chromium aplique page.route.
test.use({ serviceWorkers: 'block' });

const moreOrPrivacyLink = /^(Más|Cuenta y privacidad)$/;

const groupList = [
  {
    ...responses.group,
    members: [{ id: '6cb2496e-e5d0-4c38-a109-817ae0254512', role: 'OWNER' }],
    _count: { members: 1, events: 1, expenses: 1 },
  },
];

/** Mantiene las pruebas visuales aisladas del backend, igual que el humo existente. */
async function mockPrivateApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];
    let meta: unknown;

    if (pathname.endsWith('/auth/config')) data = { googleEnabled: false };
    else if (pathname.endsWith('/auth/methods'))
      data = { providers: ['PASSWORD'], hasPassword: true };
    else if (pathname.endsWith('/auth/me')) data = responses.me;
    else if (pathname.endsWith('/groups')) data = groupList;
    else if (pathname.endsWith('/cabudas/summary')) data = responses.cabudas;
    else if (pathname.endsWith('/cabudas/history')) {
      data = responses.cabudasHistory;
      meta = { nextCursor: null };
    } else if (pathname.endsWith('/notifications')) {
      data = responses.notifications;
      meta = { nextCursor: null };
    } else if (pathname.endsWith('/statistics/summary')) data = responses.stats;
    else if (pathname.endsWith('/achievements')) data = responses.achievements;
    else if (pathname.endsWith('/documents')) {
      data = responses.documents;
      meta = { nextCursor: null };
    } else if (pathname.endsWith('/privacy/requests')) data = responses.privacyList;
    else if (pathname.endsWith('/notifications/unread-count')) data = responses.unread;
    else if (pathname.endsWith('/notifications/preferences')) data = responses.prefs;
    else if (pathname.endsWith('/notifications/push-config'))
      data = { enabled: false, publicKey: null };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }),
    });
  });
}

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test('muestra Continuar con Google solo con configuracion publica habilitada', async ({ page }) => {
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
  await page.route('**/api/v1/auth/config', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { googleEnabled: true } }),
    }),
  );
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
});

test('las páginas principales no desbordan horizontalmente en cada viewport', async ({ page }) => {
  await mockPrivateApi(page);

  for (const path of ['/', '/login', '/register', '/forgot-password']) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }

  for (const path of ['/app', '/app/groups', '/app/cabudas', '/app/notifications', '/app/mas']) {
    await page.goto(path);
    await expect(page.locator('#contenido')).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test('la navegación principal funciona en cada viewport', async ({ page }) => {
  await mockPrivateApi(page);
  await page.goto('/app');

  const navigation = page.locator('.bottom-nav:visible, .side-rail:visible').first();
  await expect(navigation).toBeVisible();

  const groupsLink = navigation.getByRole('link', { name: 'Grupos', exact: true });
  await expect(groupsLink).toBeVisible();
  await groupsLink.click();
  await expect(page).toHaveURL(/\/app\/groups$/);

  await page.goto('/app');
  const cabudasLink = navigation.getByRole('link', { name: 'Cabudas', exact: true });
  await expect(cabudasLink).toBeVisible();
  await cabudasLink.click();
  await expect(page).toHaveURL(/\/app\/cabudas$/);

  await page.goto('/app');
  const notificationsLink = navigation.getByRole('link', { name: /^Avisos/ });
  await expect(notificationsLink).toBeVisible();
  await notificationsLink.click();
  await expect(page).toHaveURL(/\/app\/notifications$/);

  for (const [name, path] of [
    ['Docs', '/app/docs'],
    ['Estadísticas', '/app/statistics'],
    ['Logros', '/app/achievements'],
  ] as const) {
    if (await navigation.getByRole('link', { name, exact: true }).count()) {
      await page.goto('/app');
      const link = navigation.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
    }
  }

  await page.goto('/app');
  await expect(navigation.getByRole('link', { name: moreOrPrivacyLink })).toBeVisible();
  await navigation.getByRole('link', { name: moreOrPrivacyLink }).click();
  await expect(page).toHaveURL(/\/app\/mas$/);
  await expectNoHorizontalScroll(page);
});

test('muestra el estado offline y no intenta encolar un ingreso', async ({ page, context }) => {
  await mockPrivateApi(page);
  await page.goto('/app/statistics');
  await expect(page.getByRole('heading', { name: 'Cómo se mueve tu dinero' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Sin conexión.', { exact: true })).toBeVisible();
  await page.getByLabel('Importe del ingreso').fill('10.00');
  await page.getByLabel('Categoría del ingreso').fill('Prueba');
  await expect(page.getByRole('button', { name: 'Sin conexión' })).toBeDisabled();
  await context.setOffline(false);
});

test('abre un gasto con los datos del OCR prellenados y editables', async ({ page }) => {
  const groupId = responses.group.id;
  const eventId = responses.event.id;
  const jobId = 'f4b7f9ac-9c19-44c0-bf6c-0f8a1a9f6e01';
  const job = {
    id: jobId,
    documentId: '8b7f7a5e-7f25-4e8b-9c2d-1cb7f8e8d001',
    status: 'SUCCEEDED',
    attempts: 1,
    errorCode: null,
    createdAt: '2026-10-03T10:00:00.000Z',
    finishedAt: '2026-10-03T10:00:02.000Z',
    confirmedAt: null,
    confirmedExpenseId: null,
    proposal: {
      merchant: 'Mercado Central',
      totalCents: 1234,
      subtotalCents: 1100,
      taxCents: 134,
      tipCents: null,
      currency: 'USD',
      occurredAt: '2026-10-02T00:00:00.000Z',
      items: [{ name: 'Cafe', amountCents: 1234, quantity: 1, confidence: 0.9 }],
      confidence: 0.91,
      confidenceByField: {
        merchant: 0.9,
        occurredAt: 0.9,
        currency: 0.9,
        totalCents: 0.95,
        subtotalCents: 0.9,
        taxCents: 0.88,
        tipCents: null,
        items: 0.72,
      },
    },
    maxAttempts: 3,
    canRetry: false,
    provider: 'tesseract',
  };
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (pathname.endsWith('/auth/config')) data = { googleEnabled: false };
    else if (pathname.endsWith('/auth/methods'))
      data = { providers: ['PASSWORD'], hasPassword: true };
    else if (pathname.endsWith('/auth/me')) data = responses.me;
    else if (pathname === '/api/v1/groups') data = [responses.group];
    else if (pathname === `/api/v1/groups/${groupId}`) data = responses.groupDetail;
    else if (pathname === `/api/v1/groups/${groupId}/events/${eventId}`)
      data = responses.eventDetail;
    else if (pathname === `/api/v1/groups/${groupId}/categories`) data = responses.categories;
    else if (pathname === `/api/v1/ocr/jobs/${jobId}`) data = job;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.goto(`/app/groups/${groupId}/events/${eventId}/expenses/new?ocrJobId=${jobId}`);
  await expect(page.getByRole('heading', { name: 'Revisar gasto escaneado' })).toBeVisible();
  await expect(page.getByLabel('Título')).toHaveValue('Mercado Central');
  await expect(page.getByRole('textbox', { name: 'Total', exact: true })).toHaveValue('12.34');
  await expect(page.getByLabel('Nombre')).toHaveValue('Cafe');
  await expect(page.getByText('Datos sugeridos por el escaneo')).toBeVisible();
  await expect(page.getByText(/Todo es editable/)).toBeVisible();
});

test('crea un gasto con porcentaje y muestra la suma accesible', async ({ page }) => {
  const groupId = responses.group.id;
  const eventId = responses.event.id;
  let createdBody: Record<string, unknown> | undefined;
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (pathname.endsWith('/auth/me')) data = responses.me;
    else if (pathname === '/api/v1/groups') data = [responses.group];
    else if (pathname === `/api/v1/groups/${groupId}`) data = responses.groupDetail;
    else if (pathname === `/api/v1/groups/${groupId}/events/${eventId}`)
      data = responses.eventDetail;
    else if (pathname === `/api/v1/groups/${groupId}/categories`) data = responses.categories;
    else if (
      pathname === `/api/v1/groups/${groupId}/expenses` &&
      route.request().method() === 'POST'
    ) {
      createdBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      data = responses.expense;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.goto(`/app/groups/${groupId}/events/${eventId}/expenses/new`);
  await page.getByLabel('Título').fill('Cena compartida');
  await page.getByRole('textbox', { name: 'Total', exact: true }).fill('10.00');
  await page.getByRole('radio', { name: 'Porcentaje' }).check();
  const checkboxes = page.getByRole('checkbox');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.getByLabel('Porcentaje de Ana').fill('60');
  await page.getByLabel('Porcentaje de Bob').fill('40');
  await expect(page.getByText('Suma: 100.00 % / 100.00 %')).toBeVisible();
  await page.locator('#payer').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  await expect.poll(() => createdBody?.splitMode).toBe('PERCENT');
  await expect(createdBody?.participants).toEqual([
    { eventParticipantId: responses.eventDetail.participants[0].id, percentageBps: 6000 },
    { eventParticipantId: responses.eventDetail.participants[1].id, percentageBps: 4000 },
  ]);
});

test('gestiona RSVP y abre la edición completa de un evento', async ({ page }) => {
  const groupId = responses.group.id;
  const eventId = responses.event.id;
  const calls: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown = [];
    if (pathname.endsWith('/auth/me')) data = responses.me;
    else if (pathname === '/api/v1/groups') data = [responses.group];
    else if (pathname === `/api/v1/groups/${groupId}`) data = responses.groupDetail;
    else if (pathname === `/api/v1/groups/${groupId}/events/${eventId}`) {
      if (request.method() === 'PATCH') calls.push(request.method() + ' ' + pathname);
      data = responses.eventDetail;
    } else if (pathname === `/api/v1/groups/${groupId}/expenses`) data = [];
    else if (
      pathname === `/api/v1/groups/${groupId}/events/${eventId}/rsvp` &&
      request.method() === 'PUT'
    ) {
      calls.push(request.method() + ' ' + pathname);
      data = responses.eventDetail;
    } else if (pathname === '/api/v1/notifications/unread-count') data = { unread: 0 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.goto(`/app/groups/${groupId}/events/${eventId}`);
  await expect(page.getByRole('heading', { name: '¿Vas a asistir?' })).toBeVisible();
  await page.getByRole('button', { name: 'Voy', exact: true }).click();
  await expect.poll(() => calls.length).toBe(1);
  await page.getByRole('link', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { name: /Editar Evento/ })).toBeVisible();
  await expect(page.getByLabel('Fecha y hora de fin')).toBeVisible();
  await page.getByLabel('Nombre').fill('Evento actualizado');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(() => calls.filter((call) => call.startsWith('PATCH')).length).toBe(1);
  await expectNoHorizontalScroll(page);
});
