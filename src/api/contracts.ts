/** Sobre uniforme implementado por `/api/v1`. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; requestId?: string; details?: unknown };
  meta?: { requestId?: string; idempotencyReplayed?: boolean; nextCursor?: string | null };
}

/** Identidad pública devuelta por autenticación y membresías. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  /** Idioma preferido; la API 1.2 lo incluye siempre. */
  locale?: string;
  /** `false` activa el aviso de verificación; ausente se trata como verificado. */
  emailVerified?: boolean;
}

/** Sesión pública; cualquier respuesta auth puede incluir CSRF. */
export interface Session {
  user: User;
  csrfToken?: string;
}

export interface AuthConfig {
  googleEnabled: boolean;
}

export interface AuthMethods {
  providers: Array<'PASSWORD' | 'GOOGLE'>;
  hasPassword: boolean;
}

/** Membresía estable adaptada desde lista o detalle de grupo. */
export interface GroupMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt?: string;
  user?: Pick<User, 'id' | 'displayName' | 'avatarUrl'>;
}

/** Grupo estable para tarjetas, creación y detalle. */
export interface Group {
  id: string;
  name: string;
  description?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  members?: GroupMember[];
  memberCount?: number;
  eventCount?: number;
  expenseCount?: number;
  currentRole?: GroupMember['role'];
  currentMemberId?: string;
}

/** Participante canónico de un evento, registrado o invitado. */
export interface EventParticipant {
  id: string;
  guestName?: string;
  groupMember: { id: string; user?: Pick<User, 'id' | 'displayName' | 'avatarUrl'> } | null;
}

/** Evento estable adaptado desde respuestas de creación, lista o detalle. */
export interface Event {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  locationName?: string;
  locationAddress?: string;
  mapsUrl?: string;
  timeZone?: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  createdById: string;
  createdAt: string;
  participantCount?: number;
  expenseCount?: number;
  participants?: Array<
    EventParticipant & {
      rsvpStatus: 'PENDING' | 'GOING' | 'MAYBE' | 'DECLINED';
      respondedAt?: string;
    }
  >;
  links?: Array<{ id: string; label: string; url: string }>;
  reminders?: Array<{ id: string; minutesBefore: number; enabled: boolean }>;
  rsvpCounts?: Record<'PENDING' | 'GOING' | 'MAYBE' | 'DECLINED', number>;
  settlement?: { id: string; status: 'OPEN' | 'COMPLETED' | 'CANCELLED'; createdAt?: string };
}

/** Parte persistida de un gasto y su referencia al padrón del evento. */
export interface ExpenseParticipant {
  id: string;
  eventParticipantId: string;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  shareCents: number;
  eventParticipant: { guestName?: string; groupMemberId?: string };
}

/** Gasto real expresado en centavos según el contrato de la API. */
export interface Expense {
  id: string;
  groupId: string;
  eventId: string;
  title: string;
  notes?: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  currency: string;
  splitMode: 'EQUAL' | 'EXACT' | 'PERCENT';
  occurredAt: string;
  createdAt: string;
  categoryId?: string;
  participants: ExpenseParticipant[];
  payers: Array<{ id: string; eventParticipantId: string; amountCents: number }>;
  items: ExpenseItem[];
}

/** Ítem conservado con sus asignaciones reales a participantes del gasto. */
export interface ExpenseItem {
  id: string;
  name: string;
  amountCents: number;
  quantity: number;
  allocations: Array<{ eventParticipantId: string; amountCents: number }>;
}

/** Resumen de gasto devuelto por la colección del grupo. */
export interface ExpenseSummary {
  id: string;
  eventId: string;
  title: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  currency: string;
  splitMode: 'EQUAL' | 'EXACT' | 'PERCENT';
  occurredAt: string;
  createdAt: string;
  categoryId?: string;
  participantCount: number;
  itemCount: number;
}

/** Resumen de un cierre incluido en la colección del grupo. */
export interface SettlementSummary {
  id: string;
  eventId: string;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  currency: string;
  createdAt: string;
  completedAt?: string;
  transferCount: number;
}

/** Transferencia real de una liquidación. */
export interface SettlementTransfer {
  id: string;
  debtorParticipantId: string;
  creditorParticipantId: string;
  amountCents: number;
  status: 'PENDING' | 'PAID' | 'DISPUTED' | 'CANCELLED';
  paidAt?: string;
  debtor: { guestName?: string; groupMemberId?: string };
  creditor: { guestName?: string; groupMemberId?: string };
  history: Array<{
    fromStatus?: SettlementTransfer['status'];
    toStatus: SettlementTransfer['status'];
    createdAt: string;
  }>;
}

/** Detalle de cierre con transferencias y estado agregado. */
export interface SettlementDetail extends Omit<SettlementSummary, 'transferCount'> {
  groupId: string;
  transfers: SettlementTransfer[];
}

/** Respuesta reducida al marcar una transferencia como pagada. */
export interface PaidTransfer {
  id: string;
  status: 'PAID';
  amountCents: number;
  paidAt: string;
}

/** Invitación administrable del grupo. */
export interface Invitation {
  id: string;
  groupId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  lastSentAt: string | null;
  sendCount: number;
  invitedBy: { id: string; displayName: string };
}

/** Invitación creada o reenviada; `delivery` indica si salió por correo o debe compartirse. */
export interface CreatedInvitation {
  invitation: Invitation;
  token: string;
  delivery: 'email' | 'manual';
}

/** Vista previa segura antes de aceptar. */
export interface InvitationPreview {
  groupName: string;
  invitedBy: string;
  role: 'ADMIN' | 'MEMBER';
  status: Invitation['status'];
  expiresAt: string;
  emailMatches: boolean;
}

/** Membresía creada o encontrada al aceptar una invitación. */
export interface AcceptedInvitation {
  id: string;
  groupId: string;
  role: GroupMember['role'];
  joinedAt: string;
}

/** Campos normalizados para registrar una cuenta. */
export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

/** Campos normalizados para abrir sesión por cookie. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Carga real para crear un grupo. */
export interface CreateGroupInput {
  name: string;
  description?: string;
  currency: string;
}

/** Carga real de evento con colecciones explícitas. */
export interface CreateEventInput {
  name: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  locationName?: string | null;
  locationAddress?: string | null;
  mapsUrl?: string | null;
  timeZone?: string | null;
  memberIds: string[];
  guests: string[];
  links: Array<{ label: string; url: string }>;
}

export interface UpdateEventInput {
  name?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  mapsUrl?: string | null;
  timeZone?: string | null;
  links?: Array<{ label: string; url: string }>;
}

/** Carga real de gasto; la clave idempotente viaja fuera del body. */
export interface CreateExpenseInput {
  eventId: string;
  ocrJobId?: string;
  title: string;
  notes?: string;
  totalCents: number;
  subtotalCents?: number;
  taxCents?: number;
  taxPercentBps?: number;
  tipCents?: number;
  tipPercentBps?: number;
  currency: string;
  splitMode: 'EQUAL' | 'EXACT' | 'PERCENT';
  occurredAt: string;
  categoryId?: string;
  participants: Array<{
    eventParticipantId: string;
    shareCents?: number;
    percentageBps?: number;
  }>;
  payers: Array<{ eventParticipantId: string; amountCents: number }>;
  items?: Array<{
    name: string;
    amountCents: number;
    quantity: number;
    allocations: Array<{ eventParticipantId: string; amountCents: number }>;
  }>;
}
