import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import {
  loginSchema,
  registerSchema,
  type LoginValues,
  type RegisterValues,
} from '../domain/validation';
import { ErrorMessage, FieldError, Icon } from '../components/ui';

/** Entrada pública con propuesta de valor y acceso explícito, sin datos simulados. */
export function LandingPage() {
  return (
    <main className="landing">
      <header className="public-header">
        <Link to="/" className="brand">
          <span className="brand-glyph" aria-hidden="true">
            C
          </span>
          <span>Cabales</span>
        </Link>
        <Link className="button quiet" to="/login">
          Iniciar sesión
        </Link>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Gastos compartidos, sin ruido</p>
          <h1>
            Cuentas claras.
            <br />
            <span>Planes que siguen.</span>
          </h1>
          <p className="lead">
            Reúne cada salida, divide lo que corresponde y cierra transferencias sin perder el hilo
            del grupo.
          </p>
          <div className="button-row">
            <Link className="button primary" to="/register">
              Crear mi cuenta <Icon name="arrow" />
            </Link>
            <Link className="button quiet" to="/login">
              Iniciar sesión
            </Link>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-card card-a">
            <span>01</span>
            <strong>Grupo</strong>
            <small>Todo parte de las personas</small>
          </div>
          <div className="orbit-card card-b">
            <span>02</span>
            <strong>Reparto</strong>
            <small>Exacto o por partes iguales</small>
          </div>
          <div className="orbit-card card-c">
            <span>03</span>
            <strong>Cierre</strong>
            <small>Transferencias visibles</small>
          </div>
        </div>
      </section>
      <section className="principles-strip" aria-label="Capacidades">
        <span>Una sola fuente de verdad</span>
        <span>Montos precisos</span>
        <span>Sesión segura por cookie</span>
      </section>
    </main>
  );
}

/** Formulario de acceso validado que delega la sesión a cookies seguras de la API. */
export function LoginPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: cabalesApi.login,
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith('/app') ? from : '/app', { replace: true });
    },
  });
  const from = (location.state as { from?: string } | null)?.from;
  const returnPath = from?.startsWith('/app') ? from : '/app';
  if (auth.session) return <Navigate to={returnPath} replace />;
  return (
    <AuthFrame
      eyebrow="Acceso seguro"
      title="Vuelve a tus cuentas"
      alternate={
        <span>
          ¿Aún no tienes cuenta?{' '}
          <Link to="/register" state={location.state}>
            Regístrate
          </Link>
        </span>
      }
    >
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-describedby="email-error"
          {...form.register('email')}
        />
        <FieldError id="email-error" message={form.formState.errors.email?.message} />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-describedby="password-error"
          {...form.register('password')}
        />
        <FieldError id="password-error" message={form.formState.errors.password?.message} />
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <button className="button primary full" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthFrame>
  );
}

/** Formulario de alta con normalización local y confirmación obligatoria en servidor. */
export function RegisterPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: cabalesApi.register,
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith('/app') ? from : '/app', { replace: true });
    },
  });
  const from = (location.state as { from?: string } | null)?.from;
  const returnPath = from?.startsWith('/app') ? from : '/app';
  if (auth.session) return <Navigate to={returnPath} replace />;
  return (
    <AuthFrame
      eyebrow="Primer paso"
      title="Abre una cuenta clara"
      alternate={
        <span>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" state={location.state}>
            Inicia sesión
          </Link>
        </span>
      }
    >
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <label htmlFor="display-name">Nombre</label>
        <input
          id="display-name"
          autoComplete="name"
          aria-describedby="display-name-error"
          {...form.register('displayName')}
        />
        <FieldError id="display-name-error" message={form.formState.errors.displayName?.message} />
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-describedby="email-error"
          {...form.register('email')}
        />
        <FieldError id="email-error" message={form.formState.errors.email?.message} />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-error password-help"
          {...form.register('password')}
        />
        <small id="password-help">Entre 12 y 128 caracteres.</small>
        <FieldError id="password-error" message={form.formState.errors.password?.message} />
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <button className="button primary full" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthFrame>
  );
}

function AuthFrame({
  eyebrow,
  title,
  alternate,
  children,
}: {
  eyebrow: string;
  title: string;
  alternate: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card glass-panel">
        <Link to="/" className="brand">
          <span className="brand-glyph" aria-hidden="true">
            C
          </span>
          <span>Cabales</span>
        </Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
        <p className="auth-alternate">{alternate}</p>
      </section>
      <aside className="auth-aside">
        <p>“Cerrar una cuenta no debería cerrar el plan.”</p>
        <span>Diseñado para coordinar, no para complicar.</span>
      </aside>
    </main>
  );
}
