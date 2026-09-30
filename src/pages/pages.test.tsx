import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import responses from '../test/fixtures/api-responses.json';
import { apiResponse, renderPage, routeFetch } from '../test/render';
import { ForgotPasswordPage } from './AuthPages';
import { CabudasPage } from './CabudasPage';
import { AcceptInvitationPage } from './InvitationPage';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('recuperación de contraseña', () => {
  it('envía la solicitud real y muestra el mismo mensaje exista o no la cuenta', async () => {
    const fetchMock = routeFetch({
      '/api/v1/auth/password-recovery/request': () => apiResponse({ accepted: true }, 202),
    });
    renderPage(<ForgotPasswordPage />, '/forgot-password');
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ana@example.com');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'ana@example.com' });
  });

  it('valida el correo antes de llamar a la API', async () => {
    const fetchMock = routeFetch({});
    renderPage(<ForgotPasswordPage />, '/forgot-password');
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'no-es-correo' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('aceptar invitación', () => {
  it('lee el token del fragmento, lo quita de la URL y muestra la vista previa', async () => {
    const token = 'x'.repeat(43);
    window.history.replaceState(null, '', `/app/invitations/accept#token=${token}`);
    const fetchMock = routeFetch({
      '/api/v1/groups/invitations/preview': () => apiResponse(responses.preview),
    });
    renderPage(<AcceptInvitationPage />, '/app/invitations/accept');
    expect(window.location.hash).toBe('');
    expect(await screen.findByText('G1')).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aceptar/i })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ token });
  });
});

describe('Cabudas', () => {
  it('presenta totales y transferencias con datos de la API', async () => {
    routeFetch({
      '/api/v1/cabudas/summary': () => apiResponse(responses.cabudas),
      '/api/v1/cabudas/history': () =>
        apiResponse(responses.cabudasHistory, 200, { nextCursor: null }),
    });
    renderPage(<CabudasPage />, '/app/cabudas');
    expect(
      await screen.findByRole('heading', { name: 'Tus cuentas pendientes' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/4,50|4\.50/).length).toBeGreaterThan(0));
  });
});
