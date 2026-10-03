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

    if (pathname.endsWith('/auth/me')) data = responses.me;
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
    if (pathname.endsWith('/auth/me')) data = responses.me;
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
  await expect(page.getByRole('textbox', { name: 'Total' })).toHaveValue('12.34');
  await expect(page.getByLabel('Nombre')).toHaveValue('Cafe');
  await expect(page.getByText('Datos sugeridos por el escaneo')).toBeVisible();
  await expect(page.getByText(/Todo es editable/)).toBeVisible();
});
