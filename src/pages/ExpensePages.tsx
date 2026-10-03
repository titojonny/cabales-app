import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import type { CreateExpenseInput } from '../api/contracts';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import { modulesApi } from '../api/modules-api';
import { queries, queryKeys } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { ErrorMessage, FieldError, StatusPanel } from '../components/ui';
import {
  aggregateItemAllocations,
  calculateItemAllocations,
  type ItemSplitMode,
} from '../domain/item-splitting';
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
interface DraftItem {
  id: string;
  name: string;
  quantity: number;
  amount: string;
  splitMode: ItemSplitMode;
  assignedIds: string[];
  customAmounts: Record<string, string>;
}

function moneyText(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2);
}
function localDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function newDraftItem(): DraftItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: 1,
    amount: '',
    splitMode: 'EQUAL',
    assignedIds: [],
    customAmounts: {},
  };
}
function missingLabel(isOcr: boolean, value: unknown) {
  return isOcr && (value === null || value === undefined || value === '') ? (
    <span className="optional">No detectado · revisa</span>
  ) : null;
}

/** Formulario de gasto manual y borrador OCR: siempre envía el reparto EXACT resultante. */
export function CreateExpensePage() {
  const { groupId = '', eventId = '' } = useParams();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const ocrJobId = searchParams.get('ocrJobId') ?? '';
  const queryClient = useQueryClient();
  const group = useQuery({
    ...queries.group(groupId, session?.user.id ?? ''),
    enabled: Boolean(session),
  });
  const event = useQuery(queries.event(groupId, eventId));
  const categories = useQuery(moduleQueries.categories(groupId));
  const ocrJob = useQuery({
    queryKey: moduleKeys.ocrJob(ocrJobId),
    queryFn: () => modulesApi.ocrJob(ocrJobId),
    enabled: Boolean(ocrJobId),
  });
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [items, setItems] = useState<DraftItem[]>([]);
  const [submitError, setSubmitError] = useState<string>();
  const prefilled = useRef(false);
  const form = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      notes: '',
      amount: '',
      currency: 'USD',
      payerId: '',
      splitMode: 'EQUAL',
      categoryId: '',
      occurredAt: localDateTime(new Date().toISOString()),
    },
  });
  const splitMode = form.watch('splitMode');
  const amount = form.watch('amount');
  const currency = form.watch('currency');
  const proposal = ocrJob.data?.proposal;
  const isOcr = Boolean(ocrJobId);
  const mutation = useMutation({
    mutationFn: ({ input, idempotencyKey }: ExpenseAttempt) =>
      cabalesApi.createExpense(groupId, input, idempotencyKey),
    retry: 1,
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
      void queryClient.invalidateQueries({ queryKey: moduleKeys.documentsRoot });
      navigate(`/app/groups/${groupId}/expenses/${expense.id}`);
    },
  });
  useEffect(() => {
    if (group.data?.currency) form.setValue('currency', group.data.currency);
  }, [form, group.data?.currency]);
  useEffect(() => {
    if (!proposal || prefilled.current) return;
    prefilled.current = true;
    form.setValue('title', proposal.merchant ?? '');
    form.setValue('amount', moneyText(proposal.totalCents));
    if (proposal.occurredAt) form.setValue('occurredAt', localDateTime(proposal.occurredAt));
    setItems(
      proposal.items.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity ?? 1,
        amount: moneyText(item.amountCents),
        splitMode: 'EQUAL',
        assignedIds: [],
        customAmounts: {},
      })),
    );
  }, [form, proposal]);

  const participants = event.data?.participants ?? [];
  const totalCents = parseMoneyToCents(amount) ?? 0;
  const itemCalculations = useMemo(
    () =>
      items.map((item) => {
        const amountCents = parseMoneyToCents(item.amount);
        const customAmounts = Object.fromEntries(
          item.assignedIds.map((id) => [id, parseMoneyToCents(item.customAmounts[id] ?? '') ?? 0]),
        );
        return {
          item,
          amountCents,
          allocations:
            amountCents === null
              ? null
              : calculateItemAllocations({
                  amountCents,
                  participantIds: item.assignedIds,
                  splitMode: item.splitMode,
                  customAmounts,
                }),
        };
      }),
    [items],
  );
  const itemTotalCents = itemCalculations.reduce(
    (sum, calculation) => sum + (calculation.amountCents ?? 0),
    0,
  );
  const itemParticipantIds = [...new Set(items.flatMap((item) => item.assignedIds))];
  const expenseParticipantIds = items.length > 0 ? itemParticipantIds : selected;
  const itemShares = aggregateItemAllocations(
    itemCalculations.flatMap((calculation) =>
      calculation.allocations ? [calculation.allocations] : [],
    ),
  );
  const equalPreview = splitEqual(totalCents, selected);
  const itemDifference = totalCents - itemTotalCents;
  const personShares =
    items.length > 0
      ? expenseParticipantIds.map((eventParticipantId) => ({
          eventParticipantId,
          shareCents: itemShares.get(eventParticipantId) ?? 0,
        }))
      : splitMode === 'EQUAL'
        ? splitEqual(totalCents, selected).map(({ memberId, amountMinor }) => ({
            eventParticipantId: memberId,
            shareCents: amountMinor,
          }))
        : selected.map((eventParticipantId) => ({
            eventParticipantId,
            shareCents: parseMoneyToCents(exactAmounts[eventParticipantId] ?? '') ?? 0,
          }));

  // Un OCR fallido no bloquea el formulario: el aviso muestra el error y permite continuar a mano.
  if (group.isPending || event.isPending || (isOcr && ocrJob.isPending))
    return (
      <StatusPanel title="Preparando divisor">
        <p>Cargando el evento y las sugerencias del comprobante…</p>
      </StatusPanel>
    );
  if (group.isError || event.isError)
    return (
      <StatusPanel title="No pudimos preparar el gasto">
        <ErrorMessage error={group.error || event.error} />
      </StatusPanel>
    );

  const updateItem = (id: string, update: Partial<DraftItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  const toggleItemParticipant = (item: DraftItem, participantId: string, checked: boolean) =>
    updateItem(item.id, {
      assignedIds: checked
        ? [...item.assignedIds, participantId]
        : item.assignedIds.filter((id) => id !== participantId),
    });
  const submit = (values: ExpenseValues) => {
    setSubmitError(undefined);
    const total = parseMoneyToCents(values.amount);
    if (event.data.status !== 'OPEN' || event.data.settlement)
      return setSubmitError('El evento está cerrado y ya no admite gastos.');
    if (total === null) return setSubmitError('El total no es un monto válido.');
    if (expenseParticipantIds.length === 0)
      return setSubmitError('Selecciona al menos una persona para el reparto.');
    if (!expenseParticipantIds.includes(values.payerId))
      return setSubmitError('La persona que pagó también debe participar en el gasto.');
    const occurredAt = new Date(values.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return setSubmitError('La fecha no es válida.');
    let shares: Array<{ eventParticipantId: string; shareCents: number }>;
    let payloadItems: CreateExpenseInput['items'];
    if (items.length > 0) {
      if (itemDifference !== 0)
        return setSubmitError('La suma de los items debe coincidir exactamente con el total.');
      if (itemCalculations.some((calculation) => !calculation.item.name.trim()))
        return setSubmitError('Cada item necesita un nombre.');
      if (
        itemCalculations.some((calculation) => !calculation.amountCents || !calculation.allocations)
      )
        return setSubmitError('Revisa el importe y el reparto de cada item.');
      shares = expenseParticipantIds.map((eventParticipantId) => ({
        eventParticipantId,
        shareCents: itemShares.get(eventParticipantId) ?? 0,
      }));
      if (
        shares.some((share) => share.shareCents <= 0) ||
        !isExactSplitValid(
          total,
          shares.map((share) => share.shareCents),
        )
      )
        return setSubmitError(
          'Las asignaciones de items deben cubrir el total sin perder centavos.',
        );
      payloadItems = itemCalculations.map((calculation) => ({
        name: calculation.item.name,
        amountCents: calculation.amountCents!,
        quantity: calculation.item.quantity,
        allocations: calculation.allocations!.map((allocation) => ({
          eventParticipantId: allocation.eventParticipantId,
          amountCents: allocation.amountCents,
        })),
      }));
    } else {
      const exactShares = selected.map((eventParticipantId) => ({
        eventParticipantId,
        shareCents: parseMoneyToCents(exactAmounts[eventParticipantId] || ''),
      }));
      if (
        splitMode === 'EXACT' &&
        (exactShares.some((share) => share.shareCents === null) ||
          !isExactSplitValid(
            total,
            exactShares.map((share) => share.shareCents ?? 0),
          ))
      )
        return setSubmitError('Los montos exactos positivos deben sumar el total del gasto.');
      if (
        splitMode === 'EQUAL' &&
        splitEqual(total, selected).some((share) => share.amountMinor <= 0)
      )
        return setSubmitError('El total debe permitir al menos un centavo por participante.');
      shares =
        splitMode === 'EQUAL'
          ? splitEqual(total, selected).map(({ memberId, amountMinor }) => ({
              eventParticipantId: memberId,
              shareCents: amountMinor,
            }))
          : exactShares.map((share) => ({
              eventParticipantId: share.eventParticipantId,
              shareCents: share.shareCents!,
            }));
    }
    const input: CreateExpenseInput = {
      eventId,
      ...(ocrJobId ? { ocrJobId } : {}),
      title: values.title,
      ...(values.notes ? { notes: values.notes } : {}),
      ...(values.categoryId ? { categoryId: values.categoryId } : {}),
      totalCents: total,
      currency: values.currency,
      splitMode: 'EXACT',
      occurredAt: occurredAt.toISOString(),
      participants: shares,
      payers: [{ eventParticipantId: values.payerId, amountCents: total }],
      ...(payloadItems ? { items: payloadItems } : {}),
    };
    mutation.mutate({ input, idempotencyKey: crypto.randomUUID() });
  };

  return (
    <PageHeader
      eyebrow={event.data.name}
      title={isOcr ? 'Revisar gasto escaneado' : 'Registrar gasto'}
    >
      {isOcr && (
        <section className="glass-panel ocr-review-notice" aria-live="polite">
          <strong>Datos sugeridos por el escaneo</strong>
          <p>
            Todo es editable. Revisa el comprobante antes de guardar; lo no detectado queda
            pendiente.
          </p>
          <small>
            Confianza general:{' '}
            {proposal?.confidence == null
              ? 'No disponible'
              : `${Math.round(proposal.confidence * 100)} %`}
          </small>
          {ocrJob.isError && <ErrorMessage error={ocrJob.error} />}
        </section>
      )}
      <div className="split-layout">
        <section className="form-card glass-panel">
          <form onSubmit={form.handleSubmit(submit)} noValidate>
            <label htmlFor="expense-title">Título {missingLabel(isOcr, proposal?.merchant)}</label>
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
                <label htmlFor="amount">Total {missingLabel(isOcr, proposal?.totalCents)}</label>
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
            <label htmlFor="expense-occurred-at">
              Fecha {missingLabel(isOcr, proposal?.occurredAt)}
            </label>
            <input
              id="expense-occurred-at"
              type="datetime-local"
              {...form.register('occurredAt')}
            />
            <FieldError
              id="expense-occurred-at-error"
              message={form.formState.errors.occurredAt?.message}
            />
            {categories.data && categories.data.length > 0 && (
              <>
                <label htmlFor="expense-category">
                  Categoría <span className="optional">Opcional</span>
                </label>
                <select id="expense-category" {...form.register('categoryId')}>
                  <option value="">Sin categoría</option>
                  {categories.data.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="payer">Pagó el total</label>
            <select id="payer" aria-describedby="payer-error" {...form.register('payerId')}>
              <option value="">Selecciona una persona</option>
              {participants
                .filter((participant) => expenseParticipantIds.includes(participant.id))
                .map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participantLabel(participant)}
                  </option>
                ))}
            </select>
            <FieldError id="payer-error" message={form.formState.errors.payerId?.message} />
            {items.length === 0 && (
              <>
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
                  <legend>Participantes del gasto</legend>
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
              </>
            )}
            <section className="items-editor" aria-labelledby="items-heading">
              <div className="section-heading">
                <h2 id="items-heading">
                  Items <span className="optional">Opcional</span>
                </h2>
                <Button
                  variant="tertiary"
                  size="sm"
                  type="button"
                  onPress={() => setItems((current) => [...current, newDraftItem()])}
                >
                  Añadir item
                </Button>
              </div>
              {items.length === 0 && (
                <p className="muted">
                  Añade items para repartir cada consumo entre una o varias personas.
                </p>
              )}
              {items.map((item, index) => {
                const calculation = itemCalculations[index]!;
                return (
                  <article className="item-editor glass-panel" key={item.id}>
                    <div className="section-heading">
                      <h3>Item {index + 1}</h3>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                          setItems((current) => current.filter((entry) => entry.id !== item.id))
                        }
                      >
                        Eliminar
                      </button>
                    </div>
                    <label htmlFor={`item-name-${item.id}`}>Nombre</label>
                    <input
                      id={`item-name-${item.id}`}
                      value={item.name}
                      onChange={(change) => updateItem(item.id, { name: change.target.value })}
                    />
                    <div className="field-pair">
                      <div>
                        <label htmlFor={`item-quantity-${item.id}`}>Cantidad</label>
                        <input
                          id={`item-quantity-${item.id}`}
                          type="number"
                          min="1"
                          max="10000"
                          value={item.quantity}
                          onChange={(change) =>
                            updateItem(item.id, {
                              quantity: Math.max(1, Number(change.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor={`item-amount-${item.id}`}>Importe</label>
                        <input
                          id={`item-amount-${item.id}`}
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(change) =>
                            updateItem(item.id, { amount: change.target.value })
                          }
                        />
                      </div>
                    </div>
                    <fieldset>
                      <legend>Reparto del item</legend>
                      <div className="segmented">
                        <label>
                          <input
                            type="radio"
                            checked={item.splitMode === 'EQUAL'}
                            onChange={() => updateItem(item.id, { splitMode: 'EQUAL' })}
                          />
                          <span>Igual entre asignadas</span>
                        </label>
                        <label>
                          <input
                            type="radio"
                            checked={item.splitMode === 'EXACT'}
                            onChange={() => updateItem(item.id, { splitMode: 'EXACT' })}
                          />
                          <span>Importes personalizados</span>
                        </label>
                      </div>
                      <div className="participant-list">
                        {participants.map((participant) => {
                          const checked = item.assignedIds.includes(participant.id);
                          const label = participantLabel(participant);
                          const allocation = calculation.allocations?.find(
                            (entry) => entry.eventParticipantId === participant.id,
                          )?.amountCents;
                          return (
                            <div className="participant" key={participant.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(change) =>
                                    toggleItemParticipant(
                                      item,
                                      participant.id,
                                      change.target.checked,
                                    )
                                  }
                                />
                                <span>{label}</span>
                              </label>
                              {checked &&
                                (item.splitMode === 'EXACT' ? (
                                  <input
                                    aria-label={`Importe de ${label} en item ${index + 1}`}
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={item.customAmounts[participant.id] ?? ''}
                                    onChange={(change) =>
                                      updateItem(item.id, {
                                        customAmounts: {
                                          ...item.customAmounts,
                                          [participant.id]: change.target.value,
                                        },
                                      })
                                    }
                                  />
                                ) : (
                                  <strong>
                                    {allocation == null ? '—' : formatMoney(allocation, currency)}
                                  </strong>
                                ))}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                    {calculation.amountCents === null && (
                      <p className="form-field-error" role="alert">
                        Escribe un importe válido.
                      </p>
                    )}
                    {item.assignedIds.length > 0 &&
                      calculation.amountCents !== null &&
                      !calculation.allocations && (
                        <p className="form-field-error" role="alert">
                          Los importes asignados deben sumar el importe del item.
                        </p>
                      )}
                  </article>
                );
              })}
            </section>
            {submitError && (
              <p className="form-error" role="alert">
                {submitError}
              </p>
            )}
            {mutation.isError && <ErrorMessage error={mutation.error} />}
            <Button
              variant="primary"
              fullWidth
              type="submit"
              isDisabled={mutation.isPending || participants.length === 0}
            >
              {mutation.isPending ? 'Registrando…' : 'Registrar gasto'}
            </Button>
          </form>
        </section>
        <aside className="split-summary" aria-live="polite">
          <span className="eyebrow">Conciliación</span>
          <strong>{formatMoney(totalCents, currency)}</strong>
          <h2>Por persona</h2>
          {personShares.length === 0 ? (
            <p className="muted">Aún no hay personas asignadas.</p>
          ) : (
            <ul className="split-person-summary">
              {personShares.map((share) => (
                <li key={share.eventParticipantId}>
                  <span>
                    {participantLabel(
                      participants.find(
                        (participant) => participant.id === share.eventParticipantId,
                      )!,
                    )}
                  </span>
                  <strong>{formatMoney(share.shareCents, currency)}</strong>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 ? (
            <>
              <p>Suma de items: {formatMoney(itemTotalCents, currency)}</p>
              <p className={itemDifference === 0 ? 'muted' : 'form-error'}>
                Diferencia: {formatMoney(itemDifference, currency)}
              </p>
              <small>Las partes se calculan con centavos exactos y restos mayores.</small>
            </>
          ) : (
            <>
              <p>
                {selected.length} {selected.length === 1 ? 'participante' : 'participantes'}
              </p>
              <small>
                El reparto se envía como EXACT con el resultado calculado para cada persona.
              </small>
            </>
          )}
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
            <h2>Items</h2>
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
