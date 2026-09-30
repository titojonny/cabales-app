import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, MailCheck, ShieldCheck } from 'lucide-react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import type { Session } from '../api/contracts';
import { clearCsrfToken } from '../api/http';
import { modulesApi } from '../api/modules-api';
import { queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type EmailValues,
  type LoginValues,
  type RegisterValues,
  type ResetPasswordValues,
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
          aria-invalid={Boolean(form.formState.errors.email)}
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
          aria-invalid={Boolean(form.formState.errors.displayName)}
          {...form.register('displayName')}
        />
        <FieldError id="display-name-error" message={form.formState.errors.displayName?.message} />
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-describedby="email-error"
          aria-invalid={Boolean(form.formState.errors.email)}
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

/** Solicita el enlace de recuperación; la respuesta es idéntica exista o no la cuenta. */
export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string>();
  const form = useForm<EmailValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: EmailValues) => modulesApi.requestPasswordRecovery(values.email),
    onSuccess: (_data, values) => setSentTo(values.email),
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
      {sentTo ? (
        <div className="auth-result" role="status">
          <div className="recovery-icon" aria-hidden="true">
            <MailCheck size={24} />
          </div>
          <h2>Revisa tu correo</h2>
          <p>
            Si <strong>{sentTo}</strong> tiene una cuenta, recibirás un enlace para crear una nueva
            contraseña. Caduca pronto y solo funciona una vez; revisa también la carpeta de spam.
          </p>
          <div className="button-row">
            <Link className="button primary" to="/login">
              Volver al acceso
            </Link>
            <Button
              variant="tertiary"
              type="button"
              isDisabled={mutation.isPending}
              onPress={() => mutation.mutate({ email: sentTo })}
            >
              {mutation.isPending ? 'Reenviando…' : 'Reenviar enlace'}
            </Button>
          </div>
          {mutation.isError && <ErrorMessage error={mutation.error} />}
        </div>
      ) : (
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <p className="muted">Te enviaremos un enlace seguro si el correo está registrado.</p>
          <label htmlFor="recovery-email">Correo</label>
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            aria-describedby="recovery-email-error"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
          <FieldError id="recovery-email-error" message={form.formState.errors.email?.message} />
          {mutation.isError && <ErrorMessage error={mutation.error} />}
          <Button variant="primary" fullWidth type="submit" isDisabled={mutation.isPending}>
            {mutation.isPending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}

/**
 * Lee el token del fragmento `#token=` una sola vez y lo elimina de la barra y del historial:
 * el fragmento nunca viaja al servidor ni en Referer, y así tampoco queda en el navegador.
 */
function useHashToken(): string {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? '';
    if (value) window.history.replaceState(window.history.state, '', window.location.pathname);
    return /^[A-Za-z0-9_-]{32,256}$/.test(value) ? value : '';
  });
  return token;
}

/** Crea una nueva contraseña con el enlace recibido; revoca todas las sesiones abiertas. */
export function ResetPasswordPage() {
  const token = useHashToken();
  const queryClient = useQueryClient();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: ResetPasswordValues) => modulesApi.resetPassword(token, values.password),
    onSuccess: () => {
      // La API revocó todas las sesiones y limpió las cookies de este navegador.
      clearCsrfToken();
      queryClient.clear();
    },
  });
  return (
    <AuthFrame
      eyebrow="Nueva contraseña"
      title="Protege tu cuenta"
      alternate={
        <span>
          ¿Necesitas otro enlace? <Link to="/forgot-password">Solicítalo aquí</Link>
        </span>
      }
    >
      {!token ? (
        <div className="auth-result" role="status">
          <h2>Enlace no válido</h2>
          <p>El enlace está incompleto o ya se usó. Solicita uno nuevo para continuar.</p>
          <Link className="button primary" to="/forgot-password">
            Solicitar enlace
          </Link>
        </div>
      ) : mutation.isSuccess ? (
        <div className="auth-result" role="status">
          <div className="recovery-icon" aria-hidden="true">
            <ShieldCheck size={24} />
          </div>
          <h2>Contraseña actualizada</h2>
          <p>Por seguridad cerramos todas tus sesiones. Inicia sesión con tu nueva contraseña.</p>
          <Link className="button primary" to="/login">
            Iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <label htmlFor="new-password">Nueva contraseña</label>
          <PasswordField
            id="new-password"
            autoComplete="new-password"
            ariaDescribedBy="new-password-error new-password-help"
            registration={form.register('password')}
          />
          <small id="new-password-help">Usa al menos 12 caracteres.</small>
          <FieldError id="new-password-error" message={form.formState.errors.password?.message} />
          <label htmlFor="confirm-password">Confirmar contraseña</label>
          <PasswordField
            id="confirm-password"
            autoComplete="new-password"
            ariaDescribedBy="confirm-password-error"
            registration={form.register('confirmPassword')}
          />
          <FieldError
            id="confirm-password-error"
            message={form.formState.errors.confirmPassword?.message}
          />
          {mutation.isError && <ErrorMessage error={mutation.error} />}
          <Button variant="primary" fullWidth type="submit" isDisabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}

/** Confirma el correo con el enlace recibido; funciona con o sin sesión abierta. */
export function VerifyEmailPage() {
  const token = useHashToken();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const started = useRef(false);
  const mutation = useMutation({
    mutationFn: () => modulesApi.verifyEmail(token),
    onSuccess: (user) => {
      const session = queryClient.getQueryData<Session>(queryKeys.session);
      if (session && session.user.id === user.id)
        queryClient.setQueryData<Session>(queryKeys.session, { ...session, user });
    },
  });
  useEffect(() => {
    // El token es de un solo uso: evita el doble envío del modo estricto de React.
    if (!token || started.current) return;
    started.current = true;
    mutation.mutate();
  }, [mutation, token]);
  const next = auth.session ? '/app' : '/login';
  return (
    <AuthFrame
      eyebrow="Verificación"
      title="Confirma tu correo"
      alternate={<Link to={next}>{auth.session ? 'Ir a mi espacio' : 'Iniciar sesión'}</Link>}
    >
      <div className="auth-result" role="status" aria-live="polite">
        {!token ? (
          <>
            <h2>Enlace no válido</h2>
            <p>
              El enlace está incompleto. Desde tu espacio puedes pedir uno nuevo con «Reenviar
              enlace».
            </p>
          </>
        ) : mutation.isPending || mutation.isIdle ? (
          <p aria-busy="true">Confirmando tu correo…</p>
        ) : mutation.isSuccess ? (
          <>
            <div className="recovery-icon" aria-hidden="true">
              <MailCheck size={24} />
            </div>
            <h2>Correo verificado</h2>
            <p>Gracias. Ya puedes recibir invitaciones y avisos en {mutation.data.email}.</p>
            <Link className="button primary" to={next}>
              Continuar
            </Link>
          </>
        ) : (
          <>
            <h2>No pudimos verificar el correo</h2>
            <ErrorMessage error={mutation.error} />
            <p>El enlace pudo caducar o ya se usó. Solicita otro desde tu espacio.</p>
          </>
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
