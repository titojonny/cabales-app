import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiResponse, renderPage, routeFetch } from '../test/render';
import { AchievementsPage } from './AchievementsPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Logros P6', () => {
  it('muestra niveles reales y permite ocultarse del ranking', async () => {
    const fetchMock = routeFetch({
      '/api/v1/achievements': () =>
        apiResponse([
          {
            code: 'FUND_KING',
            name: 'Rey de las cabudas',
            description: 'Registra aportes.',
            category: 'CABUDAS',
            target: 15,
            progress: 5,
            status: 'UNLOCKED',
            awardedAt: '2026-10-03T12:00:00.000Z',
            currentLevel: 'SILVER',
            points: 2,
            levels: [
              { level: 'BRONZE', threshold: 1, points: 1, achieved: true },
              { level: 'SILVER', threshold: 5, points: 2, achieved: true },
              { level: 'GOLD', threshold: 15, points: 3, achieved: false },
            ],
          },
        ]),
      '/api/v1/achievements/privacy': () => apiResponse({ rankingVisible: true }),
    });
    renderPage(<AchievementsPage />, '/app/achievements');
    expect(await screen.findByRole('heading', { name: 'Rey de las cabudas' })).toBeInTheDocument();
    expect(screen.getByText(/Obtenido.*Plata/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /mostrarme/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/achievements/privacy',
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
  });
});
