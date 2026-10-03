import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const document_ = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'pasaporte.pdf',
  category: 'IDENTIDAD',
  expiresAt: '2026-10-20T00:00:00.000Z',
  expiryNoticeDays: [30, 7],
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  groupId: null,
  eventId: null,
  expenseId: null,
  settlementId: null,
  createdAt: '2026-10-03T00:00:00.000Z',
  updatedAt: '2026-10-03T00:00:00.000Z',
  lastAccessedAt: null,
  isLegacy: false,
  isPinned: true,
  owner: { id: '20000000-0000-4000-8000-000000000001', displayName: 'Ana' },
  access: 'MANAGE',
};

test('Docs muestra categorías, fijados y vencimiento', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];
    let meta: unknown;
    if (pathname.endsWith('/auth/me'))
      data = {
        user: {
          id: '20000000-0000-4000-8000-000000000001',
          email: 'ana@example.com',
          displayName: 'Ana',
          avatarUrl: null,
          locale: 'es',
          emailVerified: true,
        },
      };
    else if (pathname.endsWith('/documents/lock/status'))
      data = {
        enabled: false,
        pinEnabled: false,
        webauthnEnabled: false,
        webauthnAvailable: true,
        unlockedUntil: null,
        unlockTtlMinutes: 10,
      };
    else if (pathname.endsWith('/documents')) {
      data = [document_];
      meta = { nextCursor: null };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }),
    });
  });
  await page.goto('/app/docs');
  await expect(page.getByLabel('Filtrar por categoría')).toBeVisible();
  const documentRow = page.getByRole('listitem').filter({ hasText: document_.name });
  await expect(documentRow).toContainText('IDENTIDAD');
  await expect(documentRow).toContainText('vence');
});
