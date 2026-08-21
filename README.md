# Cabales

PWA Mobile First para organizar grupos, registrar eventos, dividir gastos y cerrar liquidaciones. Este repositorio contiene el cliente web React y consume el contrato HTTP implementado por Cabales API `/api/v1` sin importar código del servidor.

## Estado del MVP

Incluye acceso y registro, área privada, lista y creación de grupos, detalle con pestañas, lista y creación de eventos, divisor `EQUAL`/`EXACT`, detalle de gasto y gestión de liquidaciones. Cabudas, Docs, Estadísticas y Logros están integrados a la navegación como marcadores claramente rotulados, sin datos simulados ni funciones falsas.

No existe modo demo activo. Sin una API compatible, la aplicación compila y sirve la landing y los formularios públicos, mientras el área privada presenta un error controlado al no poder verificar la sesión.

## Tecnologías

- React 19 y TypeScript estricto sobre Vite.
- React Router para rutas públicas, privadas y anidadas.
- TanStack Query para estado remoto e invalidación selectiva.
- React Hook Form y Zod para formularios, normalización y validación en español.
- Tailwind CSS como pipeline de utilidades, complementado por tokens y componentes visuales propios en CSS.
- `vite-plugin-pwa` y Workbox para manifest, instalación y app shell.
- Vitest, Testing Library y Playwright para verificación automatizada.

## Arquitectura

```text
src/
  api/          Contratos locales, adaptador HTTP, endpoints, queries y telemetría segura.
  auth/         Estado de sesión en memoria y reacción central a respuestas 401.
  components/   Shell, protección de rutas, avisos PWA y primitivas accesibles.
  domain/       Validación y aritmética monetaria determinista, independientes de React.
  pages/        Composición de pantallas y formularios por flujo funcional.
  test/         Preparación común de Vitest/Testing Library.
```

La presentación no conoce `fetch` directamente. `src/api/http.ts` concentra cookies, CSRF, timeout, envelope, errores y trazabilidad; `src/api/cabales-api.ts` concentra las rutas del servidor; `src/domain` conserva reglas verificables sin acoplarse a infraestructura.

## Requisitos y puesta en marcha

Se recomienda Node.js 24 y npm 11, que son las versiones usadas para verificar esta base.

```bash
npm ci
cp .env.example .env
npm run dev
```

En PowerShell, el equivalente del segundo comando es `Copy-Item .env.example .env`. Las variables públicas son:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_CSRF_COOKIE_NAME=cabales_session_csrf
```

`VITE_API_URL` debe apuntar al prefijo versionado, sin secretos. Si se omite, el cliente usa `/api/v1` en el mismo origen. `VITE_CSRF_COOKIE_NAME` debe coincidir con `${COOKIE_NAME}_csrf` de la API y usa `cabales_session_csrf` por defecto. La cookie CSRF no es `HttpOnly`, pero debe pertenecer a un host que el cliente pueda leer; en producción se recomienda servir la API en el mismo host mediante proxy. Para CORS, la API debe permitir el origen exacto, credenciales y cookies apropiadas.

## Scripts

| Comando                | Propósito                                             |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo Vite.                          |
| `npm run build`        | Regenera iconos, valida tipos y produce `dist`.       |
| `npm run preview`      | Sirve localmente la compilación.                      |
| `npm run icons`        | Regenera PNG deterministas desde el script local.     |
| `npm run format`       | Aplica Prettier a archivos mantenidos.                |
| `npm run format:check` | Comprueba formato sin modificar.                      |
| `npm run lint`         | Ejecuta ESLint.                                       |
| `npm run typecheck`    | Ejecuta TypeScript sin emitir archivos.               |
| `npm test`             | Ejecuta pruebas unitarias y de componentes.           |
| `npm run test:e2e`     | Compila, sirve y ejecuta el humo móvil de Playwright. |

La primera ejecución E2E requiere el navegador local: `npx playwright install chromium`.

## Rutas

| Ruta                                                                | Pantalla                                          |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `/`                                                                 | Landing pública.                                  |
| `/login`, `/register`                                               | Inicio y creación de sesión.                      |
| `/app`, `/app/groups`                                               | Dashboard/lista de grupos.                        |
| `/app/groups/new`                                                   | Creación de grupo.                                |
| `/app/groups/:groupId`                                              | Resumen e integrantes.                            |
| `/app/groups/:groupId/events`                                       | Eventos del grupo.                                |
| `/app/groups/:groupId/events/new`                                   | Creación de evento.                               |
| `/app/groups/:groupId/events/:eventId`                              | Padrón, enlaces y gastos del evento.              |
| `/app/groups/:groupId/events/:eventId/expenses/new`                 | Divisor manual de gasto.                          |
| `/app/groups/:groupId/expenses/:expenseId`                          | Vista de gasto y reparto persistido.              |
| `/app/groups/:groupId/settlements`                                  | Liquidaciones y estado de transferencias.         |
| `/app/groups/:groupId/settlements/:settlementId`                    | Detalle y transferencias de una liquidación.      |
| `/app/invitations/accept?token=...`                                 | Confirmación protegida de invitación.             |
| `/app/cabudas`, `/app/docs`, `/app/statistics`, `/app/achievements` | Módulos pendientes, marcados como no disponibles. |
| `/app/mas`                                                          | Índice de módulos pendientes.                     |

## Contrato API implementado

Toda respuesta debe usar un envelope compatible con:

```ts
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; requestId?: string; details?: unknown };
  meta?: { requestId?: string; idempotencyReplayed?: boolean };
}
```

El adaptador está contrastado con `cabales-api/src/modules` y `docs/openapi.yaml`:

- `GET /auth/me`, `POST /auth/login`, `POST /auth/register`, `POST /auth/logout`.
- `GET|POST /groups` y `GET /groups/:groupId`.
- `POST /groups/:groupId/invitations` y `POST /groups/invitations/accept`.
- `GET|POST /groups/:groupId/events` y `GET /groups/:groupId/events/:eventId`.
- `GET|POST /groups/:groupId/expenses` y `GET /groups/:groupId/expenses/:expenseId`.
- `GET|POST /groups/:groupId/settlements` y `GET /groups/:groupId/settlements/:settlementId`.
- `PATCH /groups/:groupId/settlements/:settlementId/transfers/:transferId/paid`.

Registro envía `{displayName,email,password}` y consume usuarios `{id,email,displayName,avatarUrl}`. Los grupos adaptan las distintas formas de lista, creación y detalle, incluida la membresía actual para controles de UX. Las invitaciones muestran token y enlace porque el MVP no envía correo. Los eventos envían `GroupMember.id`, invitados y enlaces web. Los gastos viajan como `totalCents`, `shareCents` y `amountCents`, referenciando siempre `eventParticipantId`; el máximo es `2_147_483_647` centavos y no se truncan decimales. Ítems e historial de transferencias se conservan. Los estados contemplados son `OPEN|CLOSED|CANCELLED` para eventos, `OPEN|COMPLETED|CANCELLED` para cierres y `PENDING|PAID|DISPUTED|CANCELLED` para transferencias.

## Seguridad

- Todas las peticiones usan `credentials: 'include'`; no se guarda sesión, cookie ni token secreto en `localStorage` o `sessionStorage`.
- El cliente captura `csrfToken` de cualquier respuesta auth que lo incluya, incluido un `/me` actualizado, y lo conserva solo en memoria. Antes de una mutación sin token recupera de forma acotada la cookie configurada y envía `X-CSRF-Token`.
- Los 401 limpian CSRF y consultas privadas de manera central. La protección de rutas niega acceso hasta verificar la sesión.
- Cada petición envía `X-Request-ID`. Los registros de cliente incluyen solo operación, estado e identificador; nunca cargas, correos, contraseñas, cookies o tokens.
- El handler de submit genera una `Idempotency-Key` por intento de gasto o liquidación. La clave viaja en las variables de TanStack y se conserva durante el reintento automático de ese mismo intento.
- Las consultas reintentan una vez. Las mutaciones no reintentan por defecto; gastos y liquidaciones habilitan un reintento porque tienen clave idempotente. Marcar pago no envía clave y depende de la respuesta idempotente del endpoint.
- Los controles RBAC se ocultan según la membresía actual, pero son solo una ayuda de interfaz: la API mantiene toda decisión de autorización.
- Hay timeout de 15 segundos, errores controlados y validación Zod del envelope y de cada DTO remoto. React escapa el contenido presentado y no se usa HTML arbitrario.

## PWA y modo sin conexión

El manifest incluye iconos PNG locales de 192 y 512 píxeles, color de tema, alcance, inicio y modo standalone. Workbox precachea el app shell y los assets versionados. Cualquier URL bajo `/api/v1/` usa `NetworkOnly`: las respuestas privadas/autenticadas no se persisten en Workbox. TanStack Query sí conserva respuestas en memoria durante la sesión, con `staleTime` de 20 segundos, y se limpia al cerrar o perder la sesión.

La interfaz avisa cuando se pierde conexión y explica que no puede consultar ni guardar. No existe cola de escrituras offline porque el MVP no define todavía resolución de conflictos e idempotencia persistida. Cuando Workbox detecta una versión nueva, muestra una acción explícita para actualizar.

La instalación exige producción HTTPS o `localhost`. El service worker se valida sobre `npm run preview`, no durante el flujo normal de Vite en desarrollo.

## Accesibilidad y diseño

La interfaz parte de 320 px, usa objetivos táctiles de al menos 44 px, navegación inferior móvil y riel lateral en escritorio. Incluye enlace de salto, landmarks, etiquetas, mensajes asociados, estados anunciables, foco visible y SVG decorativos ocultos al árbol accesible cuando hay texto equivalente.

Los tokens mantienen contraste sobre una identidad glassmorphism moderada con fondo propio. `prefers-reduced-motion` elimina movimientos y `prefers-reduced-transparency` reemplaza paneles translúcidos por superficies sólidas. Las áreas fijas respetan `safe-area-inset-*`.

## Pruebas y límites actuales

Vitest cubre conservación de centavos, validación, cookie CSRF tras recarga, rutas y bodies reales, idempotencia recibida por intento, esquemas raw estrictos, transformaciones Prisma y semántica accesible. Playwright contiene un humo móvil para landing y acceso.

Limitaciones conocidas del MVP:

- No existe envío de correo: OWNER/ADMIN debe compartir manualmente el enlace de invitación mostrado una sola vez.
- Eliminar integrantes no está implementado; el divisor usa el padrón devuelto por el detalle de evento.
- Crear liquidaciones puede devolver 403 para miembros sin rol OWNER/ADMIN; la API conserva la decisión de autorización.
- Cabudas, Docs, Estadísticas y Logros quedan pendientes y no realizan consultas.
- No hay persistencia offline de datos remotos, datos demo ni escrituras offline.
- Los nombres registrados en detalles financieros se enriquecen consultando el evento; si esa consulta falla, se presenta `Participante` con ID corto sin inventar identidad.

El inventario de documentación por archivo está en `DOCUMENTACION.md`.
