import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiResponse, renderPage, routeFetch } from '../test/render';
import { EventComments } from './EventComments';

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: '00000000-0000-4000-8000-000000000001' } },
  }),
}));

describe('comentarios de eventos', () => {
  it('asocia un nombre accesible al campo de ediciÃ³n', async () => {
    routeFetch({
      '/api/v1/groups/group-1/events/event-1/comments': () =>
        apiResponse([
          {
            id: '00000000-0000-4000-8000-000000000010',
            authorUserId: '00000000-0000-4000-8000-000000000001',
            author: {
              id: '00000000-0000-4000-8000-000000000001',
              displayName: 'Ana',
              avatarUrl: null,
            },
            body: 'Texto',
            createdAt: '2026-10-03T12:00:00.000Z',
            updatedAt: '2026-10-03T12:00:00.000Z',
          },
        ]),
    });
    renderPage(<EventComments groupId="group-1" eventId="event-1" canModerate={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Editar comentario' })).toBeInTheDocument(),
    );
  });
});
