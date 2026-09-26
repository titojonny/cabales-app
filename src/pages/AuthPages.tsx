import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { useState } from 'react';
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
      <footer className="public-footer">
        <Link to="/privacy">Privacidad</Link>
        <Link to="/terms">Términos de uso</Link>
      </footer>
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
        <PasswordField
          id="password"
          autoComplete="current-password"
          ariaDescribedBy="password-error"
          registration={form.register('password')}
        />
        <FieldError id="password-error" message={form.formState.errors.password?.message} />
        <Link className="auth-forgot" to="/forgot-password">
          ¿Olvidaste tu contraseña?
        </Link>
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <Button variant="primary" fullWidth type="submit" isDisabled={mutation.isPending}>
          {mutation.isPending ? 'Ingresando…' : 'Iniciar sesión'}
        </Button>
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
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="password-field">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            aria-describedby="password-error password-help"
            {...form.register('password')}
          />
          <Button
            className="password-toggle"
            variant="tertiary"
            isIconOnly
            type="button"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onPress={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
        </div>
        <div className="password-help" id="password-help">
          <small>Usa al menos 12 caracteres.</small>
          <span className={form.watch('password').length >= 12 ? 'valid' : ''}>
            {form.watch('password').length >= 12 ? 'Lista' : 'Faltan caracteres'}
          </span>
        </div>
        <FieldError id="password-error" message={form.formState.errors.password?.message} />
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <Button variant="primary" fullWidth type="submit" isDisabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthFrame>
  );
}

/** Pantalla de recuperación preparada para el endpoint de correo del backend. */
export function ForgotPasswordPage() {
  const token = window.location.hash.startsWith('#token=')
    ? window.location.hash.slice('#token='.length)
    : '';
  const [sent, setSent] = useState(false);
  const request = useForm<{ email: string }>({ defaultValues: { email: '' } });
  const reset = useForm<{ password: string }>({ defaultValues: { password: '' } });
  const requestMutation = useMutation({
    mutationFn: (values: { email: string }) => cabalesApi.requestPasswordRecovery(values.email),
    onSuccess: () => setSent(true),
  });
  const resetMutation = useMutation({
    mutationFn: (values: { password: string }) => cabalesApi.resetPassword(token, values.password),
    onSuccess: () => setSent(true),
  });
  return (
    <AuthFrame
      eyebrow="Recuperar acceso"
      title="Volvamos a encontrarnos"
      alternate={
        <span>
          ¿Recordaste tu contraseña? <Link to="/login">Inicia sesión</Link>
        </span>
      }
    >
      <div className="recovery-placeholder">
        <div className="recovery-icon" aria-hidden="true">
          <ShieldCheck size={24} />
        </div>
        <h2>Recuperación por correo</h2>
        {sent ? (
          <>
            <p>Si la cuenta existe, recibirás instrucciones en tu correo. Revisa también spam.</p>
            <Link className="button primary full-width" to="/login">
              Volver al acceso
            </Link>
          </>
        ) : token ? (
          <form onSubmit={reset.handleSubmit((values) => resetMutation.mutate(values))} noValidate>
            <label htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              {...reset.register('password', { required: true, minLength: 12 })}
            />
            {resetMutation.isError && <ErrorMessage error={resetMutation.error} />}
            <Button variant="primary" fullWidth type="submit" isDisabled={resetMutation.isPending}>
              {resetMutation.isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={request.handleSubmit((values) => requestMutation.mutate(values))}
            noValidate
          >
            <p>Te enviaremos un enlace seguro si el correo está registrado.</p>
            <label htmlFor="recovery-email">Correo</label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              {...request.register('email', { required: true })}
            />
            {requestMutation.isError && <ErrorMessage error={requestMutation.error} />}
            <Button
              variant="primary"
              fullWidth
              type="submit"
              isDisabled={requestMutation.isPending}
            >
              {requestMutation.isPending ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        )}
      </div>
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
        <div className="auth-aside-kicker">
          <ShieldCheck size={18} /> Sesión protegida
        </div>
        <p>“Cerrar una cuenta no debería cerrar el plan.”</p>
        <span>Diseñado para coordinar, no para complicar.</span>
      </aside>
    </main>
  );
}

function PasswordField({
  id,
  autoComplete,
  ariaDescribedBy,
  registration,
}: {
  id: string;
  autoComplete: string;
  ariaDescribedBy: string;
  registration: UseFormRegisterReturn;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="password-field">
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        aria-describedby={ariaDescribedBy}
        {...registration}
      />
      <Button
        className="password-toggle"
        variant="tertiary"
        isIconOnly
        type="button"
        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onPress={() => setShowPassword((visible) => !visible)}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </Button>
    </div>
  );
}
