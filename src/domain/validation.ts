import { z } from 'zod';
import { parseMoneyToCents } from './money';

/** Normaliza texto humano con Unicode NFC, espacios exteriores y espacios repetidos. */
export function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

const normalizedText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(min, `${label} debe tener al menos ${min} caracteres.`)
        .max(max, `${label} no puede superar ${max} caracteres.`),
    );

/** Esquema de autenticación con correo canónico y límites explícitos. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Escribe un correo válido.')
    .max(320, 'El correo es demasiado largo.'),
  password: z
    .string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres.')
    .max(128, 'La contraseña no puede superar 128 caracteres.'),
});

/** Esquema de registro; la política definitiva de contraseña también corresponde a la API. */
export const registerSchema = loginSchema.extend({
  displayName: normalizedText(2, 120, 'El nombre'),
});

/** Esquema de creación de grupo con monedas permitidas en este MVP. */
export const groupSchema = z.object({
  name: normalizedText(2, 120, 'El nombre'),
  description: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().max(500, 'La descripción no puede superar 500 caracteres.'))
    .optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'La moneda debe ser un código ISO de tres letras.'),
});

/** Esquema de evento con fecha ISO transformada desde un control local. */
export const eventSchema = z.object({
  name: normalizedText(2, 160, 'El nombre'),
  description: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().max(1000, 'La descripción no puede superar 1000 caracteres.'))
    .optional(),
  startsAt: z.string().min(1, 'Selecciona la fecha y hora.'),
  memberIds: z
    .array(z.string().uuid())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'No repitas integrantes.',
    }),
  guests: z
    .array(normalizedText(1, 120, 'El nombre del invitado'))
    .max(100)
    .refine(
      (names) => new Set(names.map((name) => name.toLocaleLowerCase('es'))).size === names.length,
      { message: 'No repitas invitados.' },
    ),
  links: z
    .array(
      z.object({
        label: normalizedText(1, 80, 'La etiqueta'),
        url: z
          .string()
          .url('Escribe un enlace válido.')
          .max(2048)
          .refine((url) => ['http:', 'https:'].includes(new URL(url).protocol), {
            message: 'El enlace debe usar http o https.',
          }),
      }),
    )
    .max(20),
});

/** Esquema de invitación limitado a roles delegables por la API. */
export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Escribe un correo válido.').max(320),
  role: z.enum(['ADMIN', 'MEMBER']),
});

/** Esquema del token opaco exigido para aceptar una invitación. */
export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(20, 'El token está incompleto.').max(200, 'El token es inválido.'),
});

/** Esquema base del divisor; la suma exacta se valida con los participantes seleccionados. */
export const expenseSchema = z.object({
  title: normalizedText(1, 160, 'El título'),
  notes: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().max(1000, 'Las notas no pueden superar 1000 caracteres.'))
    .optional(),
  amount: z.string().refine((value) => parseMoneyToCents(value) !== null, {
    message: 'Usa un monto positivo, máximo dos decimales y no más de 21 474 836,47.',
  }),
  currency: z.string().regex(/^[A-Z]{3}$/, 'La moneda debe ser un código ISO de tres letras.'),
  payerId: z.string().uuid('Selecciona quién pagó.'),
  splitMode: z.enum(['EQUAL', 'EXACT']),
});

/** Valores validados del inicio de sesión. */
export type LoginValues = z.infer<typeof loginSchema>;
/** Valores validados del registro. */
export type RegisterValues = z.infer<typeof registerSchema>;
/** Valores validados al crear un grupo. */
export type GroupValues = z.infer<typeof groupSchema>;
/** Valores validados al crear un evento. */
export type EventValues = z.infer<typeof eventSchema>;
/** Valores validados por el divisor manual. */
export type ExpenseValues = z.infer<typeof expenseSchema>;
/** Valores validados al crear una invitación. */
export type InvitationValues = z.infer<typeof invitationSchema>;
/** Valores validados al aceptar una invitación. */
export type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;
