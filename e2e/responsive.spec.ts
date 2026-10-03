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
