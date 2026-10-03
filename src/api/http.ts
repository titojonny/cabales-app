import type { ApiEnvelope } from './contracts';
import { recordTelemetry } from './telemetry';
import type { ZodType } from 'zod';

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URL = (configuredBaseUrl || '/api/v1').replace(/\/$/, '');

/** Construye URLs de navegación manteniendo el origen configurable de la API. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
const configuredCsrfCookieName = import.meta.env.VITE_CSRF_COOKIE_NAME?.trim();
const CSRF_COOKIE_NAME =
  configuredCsrfCookieName && /^[A-Za-z0-9_-]{1,128}$/.test(configuredCsrfCookieName)
    ? configuredCsrfCookieName
    : 'cabales_session_csrf';
const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfToken: string | undefined;
const unauthorizedListeners = new Set<() => void>();

/** Error controlado de infraestructura con información segura para la interfaz. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'HTTP_ERROR',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Permite al estado de autenticación reaccionar a cualquier 401 de forma central. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** Limpia el único dato CSRF mantenido en memoria al cerrar o perder la sesión. */
export function clearCsrfToken(): void {
  csrfToken = undefined;
}

/** Recupera únicamente la cookie CSRF configurada y rechaza valores no aptos para cabeceras. */
export function readCsrfCookie(cookieSource = document.cookie): string | undefined {
  const encodedValue = cookieSource
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.slice(CSRF_COOKIE_NAME.length + 1);
  if (!encodedValue) return undefined;
  try {
    const value = decodeURIComponent(encodedValue);
    return /^[A-Za-z0-9_-]{16,512}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Opciones adicionales admitidas por el adaptador HTTP. */
export interface RequestOptions<T> extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Cuerpo binario (subida de documentos); se envía tal cual con su tipo MIME. */
  rawBody?: Blob;
  idempotencyKey?: string;
  schema?: ZodType<T>;
}

/** Metadatos de paginación y reproducción idempotente devueltos por la API. */
export interface ResponseMeta {
  nextCursor?: string | null;
  idempotencyReplayed?: boolean;
}

export interface FileResponse {
  blob: Blob;
  headers: Headers;
}

/** Operación de telemetría sin query string: evita registrar nombres de archivo o filtros. */
function operationName(path: string): string {
  return path.split('?')[0] ?? path;
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { success?: unknown }).success === 'boolean',
  );
}

function captureCsrf(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const candidate = (data as { csrfToken?: unknown }).csrfToken;
  if (typeof candidate === 'string' && candidate.length >= 16 && candidate.length <= 512)
    csrfToken = candidate;
}

/** Ejecuta una petición con cookie, timeout, trazabilidad y validación del sobre. */
export async function request<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  return (await requestWithMeta(path, options)).data;
}

/** Descarga una respuesta binaria conservando cookies de sesión y sus cabeceras. */
export async function requestFile(
  path: string,
  options: Omit<RequestOptions<never>, 'body' | 'rawBody' | 'schema'> = {},
): Promise<FileResponse> {
  const operation = operationName(path);
  const method = (options.method || 'GET').toUpperCase();
  const requestId = crypto.randomUUID();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'text/csv, application/pdf, application/octet-stream');
  headers.set('X-Request-ID', requestId);
  if (mutationMethods.has(method) && !csrfToken) csrfToken = readCsrfCookie();
  if (mutationMethods.has(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const init = options;
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      method,
      headers,
      credentials: 'include',
      signal: init.signal ?? AbortSignal.timeout(60_000),
    });
  } catch {
    recordTelemetry({ event: 'api_failure', operation, requestId });
    throw new HttpError(
      navigator.onLine
        ? 'No pudimos descargar el archivo. Intenta de nuevo.'
        : 'No hay conexión. El archivo no se descargó.',
      0,
      'NETWORK_ERROR',
    );
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      clearCsrfToken();
      unauthorizedListeners.forEach((listener) => listener());
    }
    recordTelemetry({ event: 'api_failure', operation, status: response.status, requestId });
    throw new HttpError(
      payload?.error?.message || 'No fue posible descargar el archivo.',
      response.status,
      payload?.error?.code || 'HTTP_ERROR',
    );
  }
  return { blob: await response.blob(), headers: response.headers };
}

/** Igual que `request`, pero conserva `meta` para cursores e idempotencia. */
export async function requestWithMeta<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<{ data: T; meta: ResponseMeta }> {
  const operation = operationName(path);
  const method = (options.method || 'GET').toUpperCase();
  if (mutationMethods.has(method) && typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new HttpError(
      'Sin conexión. Esta acción está deshabilitada y no se encolan pagos ni cambios.',
      0,
      'OFFLINE_MUTATION',
    );
  }
  const requestId = crypto.randomUUID();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Request-ID', requestId);
  if (options.rawBody)
    headers.set('Content-Type', options.rawBody.type || 'application/octet-stream');
  else if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (mutationMethods.has(method) && !csrfToken) csrfToken = readCsrfCookie();
  if (mutationMethods.has(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);

  const { body, rawBody, schema, ...init } = options;
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      method,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
      credentials: 'include',
      // Las subidas pueden tardar más que una consulta normal.
      signal: init.signal ?? AbortSignal.timeout(rawBody ? 60_000 : 15_000),
    });
  } catch (error) {
    recordTelemetry({ event: 'api_failure', operation, requestId });
    const message =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'La solicitud tardó demasiado. Intenta de nuevo.'
        : navigator.onLine
          ? 'No pudimos conectar con Cabales. Intenta de nuevo.'
          : 'No hay conexión. Tus cambios no se enviaron.';
    throw new HttpError(message, 0, 'NETWORK_ERROR');
  }

  const responseRequestId = response.headers.get('X-Request-ID') || requestId;
  const payload: unknown =
    response.status === 204
      ? { success: true, data: undefined }
      : await response.json().catch(() => null);
  if (!isEnvelope(payload)) {
    recordTelemetry({
      event: 'api_failure',
      operation,
      status: response.status,
      requestId: responseRequestId,
    });
    throw new HttpError(
      'La API devolvió una respuesta no válida.',
      response.status,
      'INVALID_ENVELOPE',
    );
  }

  if (response.status === 401) {
    clearCsrfToken();
    unauthorizedListeners.forEach((listener) => listener());
    recordTelemetry({
      event: 'api_unauthorized',
      operation,
      status: 401,
      requestId: responseRequestId,
    });
  }

  if (!response.ok || !payload.success) {
    recordTelemetry({
      event: 'api_failure',
      operation,
      status: response.status,
      requestId: responseRequestId,
    });
    throw new HttpError(
      payload.error?.message || 'No fue posible completar la operación.',
      response.status,
      payload.error?.code,
    );
  }

  const meta = (payload.meta ?? {}) as ResponseMeta;
  if (schema) {
    const result = schema.safeParse(payload.data);
    if (!result.success) {
      recordTelemetry({
        event: 'api_failure',
        operation,
        status: response.status,
        requestId: responseRequestId,
      });
      throw new HttpError(
        'La API devolvió datos con una estructura no válida.',
        response.status,
        'INVALID_DATA',
      );
    }
    captureCsrf(result.data);
    return { data: result.data, meta };
  }

  captureCsrf(payload.data);
  return { data: payload.data as T, meta };
}
