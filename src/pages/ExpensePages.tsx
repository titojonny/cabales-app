import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import type { CreateExpenseInput } from '../api/contracts';
import { queries, queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { ErrorMessage, FieldError, StatusPanel } from '../components/ui';
import { formatMoney, isExactSplitValid, parseMoneyToCents, splitEqual } from '../domain/money';
import {
  fallbackParticipantLabel,
  participantLabel,
  participantLabelMap,
} from '../domain/participants';
import { expenseSchema, type ExpenseValues } from '../domain/validation';
import { PageHeader } from './GroupPages';

interface ExpenseAttempt {
  input: CreateExpenseInput;
  idempotencyKey: string;
}

/** Divide un gasto sobre el padrón canónico del evento y conserva la clave por intento. */
export function CreateExpensePage() {
  const { groupId = '', eventId = '' } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const event = useQuery(queries.event(groupId, eventId));
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      notes: '',
      amount: '',
      currency: 'USD',
      payerId: '',
      splitMode: 'EQUAL',
    },
  });
  const splitMode = form.watch('splitMode');
  const amount = form.watch('amount');
  const currency = form.watch('currency');
  const mutation = useMutation({
    mutationFn: ({ input, idempotencyKey }: ExpenseAttempt) =>
      cabalesApi.createExpense(groupId, input, idempotencyKey),
    retry: 1,
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
      navigate(`/app/groups/${groupId}/expenses/${expense.id}`);
    },
  });

  useEffect(() => {
    if (group.data?.currency) form.setValue('currency', group.data.currency);
  }, [form, group.data?.currency]);

  if (group.isPending || event.isPending)
    return (
      <StatusPanel title="Preparando divisor">
        <p>Cargando el padrón canónico del evento…</p>
      </StatusPanel>
    );
  if (group.isError || event.isError)
    return (
      <StatusPanel title="No pudimos preparar el gasto">
        <ErrorMessage error={group.error || event.error} />
      </StatusPanel>
    );

  const participants = event.data.participants ?? [];
  const totalCents = parseMoneyToCents(amount) ?? 0;
  const equalPreview = splitEqual(totalCents, selected);

  const submit = (values: ExpenseValues) => {
    setSubmitError(undefined);
    const total = parseMoneyToCents(values.amount);
    if (event.data.status !== 'OPEN' || event.data.settlement)
      return setSubmitError('El evento está cerrado y ya no admite gastos.');
    if (total === null) return setSubmitError('El total no es un monto válido.');
    if (selected.length === 0)
      return setSubmitError('Selecciona al menos una persona para el reparto.');
    if (!selected.includes(values.payerId))
      return setSubmitError('La persona que pagó también debe participar en el gasto.');

    const exactShares = selected.map((eventParticipantId) => ({
      eventParticipantId,
      shareCents: parseMoneyToCents(exactAmounts[eventParticipantId] || ''),
    }));
    if (
      values.splitMode === 'EXACT' &&
      (exactShares.some((share) => share.shareCents === null) ||
        !isExactSplitValid(
          total,
          exactShares.map((share) => share.shareCents ?? 0),
        ))
    )
      return setSubmitError('Los montos exactos positivos deben sumar el total del gasto.');
    if (
      values.splitMode === 'EQUAL' &&
      splitEqual(total, selected).some((share) => share.amountMinor <= 0)
    )
      return setSubmitError('El total debe permitir al menos un centavo por participante.');

    const input: CreateExpenseInput = {
      eventId,
      title: values.title,
      ...(values.notes ? { notes: values.notes } : {}),
      totalCents: total,
      currency: values.currency,
      splitMode: values.splitMode,
      occurredAt: new Date().toISOString(),
      participants:
        values.splitMode === 'EQUAL'
          ? selected.map((eventParticipantId) => ({ eventParticipantId }))
          : exactShares.map((share) => ({
              eventParticipantId: share.eventParticipantId,
              shareCents: share.shareCents!,
            })),
      payers: [{ eventParticipantId: values.payerId, amountCents: total }],
    };
    mutation.mutate({ input, idempotencyKey: crypto.randomUUID() });
  };

  return (
    <PageHeader eyebrow={event.data.name} title="Registrar gasto">
      <div className="split-layout">
        <section className="form-card glass-panel">
          <form onSubmit={form.handleSubmit(submit)} noValidate>
            <label htmlFor="expense-title">Título</label>
            <input
              id="expense-title"
              aria-describedby="expense-title-error"
              {...form.register('title')}
            />
            <FieldError id="expense-title-error" message={form.formState.errors.title?.message} />
            <label htmlFor="expense-notes">
              Notas <span className="optional">Opcional</span>
            </label>
            <textarea id="expense-notes" rows={2} {...form.register('notes')} />
            <FieldError id="expense-notes-error" message={form.formState.errors.notes?.message} />
            <div className="field-pair">
              <div>
                <label htmlFor="amount">Total</label>
                <input
                  id="amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-describedby="amount-error"
                  {...form.register('amount')}
                />
                <FieldError id="amount-error" message={form.formState.errors.amount?.message} />
              </div>
              <div>
                <label htmlFor="expense-currency">Moneda del grupo</label>
                <select id="expense-currency" {...form.register('currency')}>
                  <option value={group.data.currency}>{group.data.currency}</option>
                </select>
              </div>
            </div>
            <label htmlFor="payer">Pagó el total</label>
            <select id="payer" aria-describedby="payer-error" {...form.register('payerId')}>
              <option value="">Selecciona una persona</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participantLabel(participant)}
                </option>
              ))}
            </select>
            <FieldError id="payer-error" message={form.formState.errors.payerId?.message} />
            <fieldset>
              <legend>Tipo de reparto</legend>
              <div className="segmented">
                <label>
                  <input type="radio" value="EQUAL" {...form.register('splitMode')} />
                  <span>Partes iguales</span>
                </label>
                <label>
                  <input type="radio" value="EXACT" {...form.register('splitMode')} />
                  <span>Montos exactos</span>
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Participantes del evento</legend>
              {participants.length === 0 ? (
                <p className="muted">El evento no tiene participantes disponibles.</p>
              ) : (
                <div className="participant-list">
                  {participants.map((participant) => {
                    const checked = selected.includes(participant.id);
                    const equalAmount =
                      equalPreview.find((share) => share.memberId === participant.id)
                        ?.amountMinor ?? 0;
                    const label = participantLabel(participant);
                    return (
                      <div className="participant" key={participant.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(change) =>
                              setSelected((current) =>
                                change.target.checked
                                  ? [...current, participant.id]
                                  : current.filter((id) => id !== participant.id),
                              )
                            }
                          />
                          <span>{label}</span>
                        </label>
                        {checked &&
                          (splitMode === 'EXACT' ? (
                            <input
                              aria-label={`Monto de ${label}`}
                              inputMode="decimal"
                              placeholder="0.00"
                              value={exactAmounts[participant.id] ?? ''}
                              onChange={(change) =>
                                setExactAmounts((current) => ({
                                  ...current,
                                  [participant.id]: change.target.value,
                                }))
                              }
                            />
                          ) : (
                            <strong>{formatMoney(equalAmount, currency)}</strong>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>
            {submitError && (
              <p className="form-error" role="alert">
                {submitError}
              </p>
            )}
            {mutation.isError && <ErrorMessage error={mutation.error} />}
            <button
              className="button primary full"
              type="submit"
              disabled={mutation.isPending || participants.length === 0}
            >
              {mutation.isPending ? 'Registrando…' : 'Registrar gasto'}
            </button>
          </form>
        </section>
        <aside className="split-summary">
          <span className="eyebrow">Control de suma</span>
          <strong>{formatMoney(totalCents, currency)}</strong>
          <p>
            {selected.length} {selected.length === 1 ? 'participante' : 'participantes'}
          </p>
          <small>
            EQUAL omite `shareCents`; EXACT envía una parte positiva por participante. Un pagador
            cubre el total en este MVP.
          </small>
        </aside>
      </div>
    </PageHeader>
  );
}

/** Consulta el gasto anidado y usa el evento para resolver nombres cuando está disponible. */
export function ExpenseDetailPage() {
  const { groupId = '', expenseId = '' } = useParams();
  const expense = useQuery(queries.expense(groupId, expenseId));
  const eventId = expense.data?.eventId ?? '';
  const event = useQuery({ ...queries.event(groupId, eventId), enabled: Boolean(eventId) });
  if (expense.isPending)
    return (
      <StatusPanel title="Cargando gasto">
        <p>Consultando monto, partes y pagadores…</p>
      </StatusPanel>
    );
  if (expense.isError)
    return (
      <StatusPanel title="No pudimos abrir el gasto">
        <ErrorMessage error={expense.error} />
      </StatusPanel>
    );

  const labels = participantLabelMap(event.data?.participants);
  const labelFor = (participantId: string, guestName?: string) =>
    labels.get(participantId) || fallbackParticipantLabel(participantId, guestName);

  return (
    <PageHeader
      eyebrow={expense.data.splitMode === 'EQUAL' ? 'Partes iguales' : 'Montos exactos'}
      title={expense.data.title}
    >
      <section className="expense-detail glass-panel">
        <div className="expense-total">
          <span>Total</span>
          <strong>{formatMoney(expense.data.totalCents, expense.data.currency)}</strong>
        </div>
        {expense.data.notes && <p className="muted">{expense.data.notes}</p>}
        <h2>Reparto</h2>
        <ul>
          {expense.data.participants.map((participant) => (
            <li key={participant.id}>
              <span>
                {labelFor(participant.eventParticipantId, participant.eventParticipant.guestName)}
              </span>
              <strong>{formatMoney(participant.shareCents, expense.data.currency)}</strong>
            </li>
          ))}
        </ul>
        <h2>Pagó</h2>
        <ul>
          {expense.data.payers.map((payer) => (
            <li key={payer.id}>
              <span>{labelFor(payer.eventParticipantId)}</span>
              <strong>{formatMoney(payer.amountCents, expense.data.currency)}</strong>
            </li>
          ))}
        </ul>
        {expense.data.items.length > 0 && (
          <>
            <h2>Ítems</h2>
            <ul>
              {expense.data.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <strong>{formatMoney(item.amountCents, expense.data.currency)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
        {event.isError && (
          <p className="muted" role="status">
            No se pudieron recuperar nombres registrados; se muestran identificadores honestos.
          </p>
        )}
        <Link className="button quiet" to={`/app/groups/${groupId}/events`}>
          Volver a eventos
        </Link>
      </section>
    </PageHeader>
  );
}
