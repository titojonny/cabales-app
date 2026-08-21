import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { NetworkStatus } from './components/NetworkStatus';
import './styles.css';

/** Reintenta consultas una vez; mutaciones no reintentan salvo flujos financieros idempotentes. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el contenedor principal de Cabales.');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <a className="skip-link" href="#contenido">
            Saltar al contenido
          </a>
          <NetworkStatus />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
