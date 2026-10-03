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
import {
  formatMoney,
  isExactSplitValid,
  parseMoneyToCents,
  parsePercentageToBps,
  roundPercentageCents,
  splitEqual,
  splitPercentage,
  splitProportional,
} from '../domain/money';
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
  const tags = useQuery(moduleQueries.groupTags(groupId));
  const ocrJob = useQuery({
    queryKey: moduleKeys.ocrJob(ocrJobId),
    queryFn: () => modulesApi.ocrJob(ocrJobId),
    enabled: Boolean(ocrJobId),
  });
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
      subtotal: '',
      taxMode: 'AMOUNT',
      taxValue: '',
      tipMode: 'PERCENT',
      tipValue: '',
      currency: 'USD',
      payerId: '',
      splitMode: 'EQUAL',
      categoryId: '',
      occurredAt: localDateTime(new Date().toISOString()),
    },
  });
  const splitMode = form.watch('splitMode');
  const amount = form.watch('amount');
  const subtotalInput = form.watch('subtotal') ?? '';
  const taxMode = form.watch('taxMode');
  const taxValue = form.watch('taxValue');
  const tipMode = form.watch('tipMode');
  const tipValue = form.watch('tipValue');
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
    form.setValue('subtotal', moneyText(proposal.subtotalCents ?? proposal.totalCents));
    if (proposal.taxCents != null) {
      form.setValue('taxMode', 'AMOUNT');
      form.setValue('taxValue', moneyText(proposal.taxCents));
    }
    if (proposal.tipCents != null) {
      form.setValue('tipMode', 'AMOUNT');
      form.setValue('tipValue', moneyText(proposal.tipCents));
    }
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
  const explicitSubtotalCents = parseMoneyToCents(subtotalInput);
  const subtotalCents = explicitSubtotalCents ?? parseMoneyToCents(amount) ?? 0;
  const taxCents =
    taxValue && taxMode === 'PERCENT'
      ? (() => {
          const bps = parsePercentageToBps(taxValue);
          return bps == null ? 0 : roundPercentageCents(subtotalCents, bps);
        })()
      : (parseMoneyToCents(taxValue) ?? 0);
  const tipCents =
    tipValue && tipMode === 'PERCENT'
      ? (() => {
          const bps = parsePercentageToBps(tipValue);
          return bps == null ? 0 : roundPercentageCents(subtotalCents, bps);
        })()
      : (parseMoneyToCents(tipValue) ?? 0);
  const totalCents = subtotalCents + taxCents + tipCents;
  const [percentageValues, setPercentageValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (subtotalInput && totalCents > 0) {
      form.setValue('amount', moneyText(totalCents), { shouldValidate: true });
    }
  }, [form, subtotalInput, taxValue, tipValue, totalCents]);
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
  const percentageBps = selected.map(
    (eventParticipantId) => parsePercentageToBps(percentageValues[eventParticipantId] ?? '') ?? 0,
  );
  const percentageTotalBps = percentageBps.reduce((sum, value) => sum + value, 0);
  const itemShares = aggregateItemAllocations(
    itemCalculations.flatMap((calculation) =>
      calculation.allocations ? [calculation.allocations] : [],
    ),
  );
  const equalPreview = splitEqual(subtotalCents, selected);
  const itemDifference = subtotalCents - itemTotalCents;
  const personShares =
    items.length > 0
      ? splitMode === 'PERCENT'
        ? expenseParticipantIds.map((eventParticipantId, index) => ({
            eventParticipantId,
            shareCents:
              splitPercentage(
                subtotalCents,
                expenseParticipantIds.map(
                  (id) => parsePercentageToBps(percentageValues[id] ?? '') ?? 0,
                ),
              )[index] ?? 0,
          }))
        : expenseParticipantIds.map((eventParticipantId) => ({
            eventParticipantId,
            shareCents: itemShares.get(eventParticipantId) ?? 0,
          }))
      : splitMode === 'EQUAL'
        ? splitEqual(subtotalCents, selected).map(({ memberId, amountMinor }) => ({
            eventParticipantId: memberId,
            shareCents: amountMinor,
          }))
        : splitMode === 'PERCENT'
          ? splitPercentage(subtotalCents, percentageBps).map((shareCents, index) => ({
              eventParticipantId: selected[index]!,
              shareCents,
            }))
          : selected.map((eventParticipantId) => ({
              eventParticipantId,
              shareCents: parseMoneyToCents(exactAmounts[eventParticipantId] ?? '') ?? 0,
            }));
  const taxShares = splitProportional(
    taxCents,
    personShares.map((share) => share.shareCents),
  );
  const tipShares = splitProportional(
    tipCents,
    personShares.map((share) => share.shareCents),
  );
  const personBreakdown = personShares.map((share, index) => ({
    ...share,
    taxCents: taxShares[index] ?? 0,
    tipCents: tipShares[index] ?? 0,
    totalCents: share.shareCents + (taxShares[index] ?? 0) + (tipShares[index] ?? 0),
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
    if (total === null || totalCents <= 0) return setSubmitError('El total no es un monto válido.');
    if (expenseParticipantIds.length === 0)
      return setSubmitError('Selecciona al menos una persona para el reparto.');
    if (!expenseParticipantIds.includes(values.payerId))
      return setSubmitError('La persona que pagó también debe participar en el gasto.');
    if (splitMode === 'PERCENT' && percentageTotalBps !== 10_000)
      return setSubmitError('Los porcentajes deben sumar exactamente 100 %.');
    if (items.length > 0 && splitMode === 'PERCENT')
      return setSubmitError(
        'Para combinar items con porcentajes, asigna primero los items y usa Montos exactos.',
      );
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
          subtotalCents,
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
            subtotalCents,
            exactShares.map((share) => share.shareCents ?? 0),
          ))
      )
        return setSubmitError('Los montos exactos positivos deben sumar el total del gasto.');
      if (
        splitMode === 'EQUAL' &&
        splitEqual(subtotalCents, selected).some((share) => share.amountMinor <= 0)
      )
        return setSubmitError('El total debe permitir al menos un centavo por participante.');
      shares =
        splitMode === 'EQUAL'
          ? splitEqual(subtotalCents, selected).map(({ memberId, amountMinor }) => ({
              eventParticipantId: memberId,
              shareCents: amountMinor,
            }))
          : exactShares.map((share) => ({
              eventParticipantId: share.eventParticipantId,
              shareCents: share.shareCents!,
            }));
    }
    const payloadSplitMode = items.length > 0 ? 'EXACT' : splitMode;
    const input: CreateExpenseInput = {
      eventId,
      ...(ocrJobId ? { ocrJobId } : {}),
      title: values.title,
      ...(values.notes ? { notes: values.notes } : {}),
      ...(values.categoryId ? { categoryId: values.categoryId } : {}),
      tagIds: selectedTags,
      totalCents,
      ...(subtotalInput || taxValue || tipValue ? { subtotalCents } : {}),
      ...(taxValue
        ? taxMode === 'PERCENT'
          ? { taxPercentBps: parsePercentageToBps(taxValue)! }
          : { taxCents: parseMoneyToCents(taxValue)! }
        : {}),
      ...(tipValue
        ? tipMode === 'PERCENT'
          ? { tipPercentBps: parsePercentageToBps(tipValue)! }
          : { tipCents: parseMoneyToCents(tipValue)! }
        : {}),
      currency: values.currency,
      splitMode: payloadSplitMode,
      occurredAt: occurredAt.toISOString(),
      participants:
        payloadSplitMode === 'PERCENT'
          ? expenseParticipantIds.map((eventParticipantId) => ({
              eventParticipantId,
              percentageBps: parsePercentageToBps(percentageValues[eventParticipantId] ?? '') ?? 0,
            }))
          : shares,
      payers: [{ eventParticipantId: values.payerId, amountCents: totalCents }],
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
                  readOnly={Boolean(subtotalInput)}
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
            <p className="field-help">El total incluye subtotal, impuesto y propina.</p>
            <div className="field-pair even">
              <div>
                <label htmlFor="expense-subtotal">
                  Subtotal <span className="optional">Opcional si no hay cargos</span>
                </label>
                <input
                  id="expense-subtotal"
                  inputMode="decimal"
                  placeholder="Igual al total"
                  aria-describedby="expense-subtotal-error"
                  {...form.register('subtotal')}
                />
                <FieldError
                  id="expense-subtotal-error"
                  message={form.formState.errors.subtotal?.message}
                />
              </div>
              <div>
                <label htmlFor="expense-tax">Impuesto</label>
                <div className="field-pair even">
                  <select id="expense-tax-mode" {...form.register('taxMode')}>
                    <option value="AMOUNT">Importe</option>
                    <option value="PERCENT">Porcentaje</option>
                  </select>
                  <input
                    id="expense-tax"
                    inputMode="decimal"
                    placeholder={taxMode === 'PERCENT' ? '0.00 %' : '0.00'}
                    aria-label="Valor del impuesto"
                    {...form.register('taxValue')}
                  />
                </div>
              </div>
            </div>
            <div className="field-pair even">
              <div>
                <label htmlFor="expense-tip">Propina</label>
                <div className="field-pair even">
                  <select id="expense-tip-mode" {...form.register('tipMode')}>
                    <option value="AMOUNT">Importe</option>
                    <option value="PERCENT">Porcentaje</option>
                  </select>
                  <input
                    id="expense-tip"
                    inputMode="decimal"
                    placeholder={tipMode === 'PERCENT' ? '0.00 %' : '0.00'}
                    aria-label="Valor de la propina"
                    {...form.register('tipValue')}
                  />
                </div>
                <div className="tip-shortcuts" aria-label="Atajos de propina">
                  {[10, 15, 20].map((percent) => (
                    <button
                      className="text-button"
                      type="button"
                      key={percent}
                      onClick={() => {
                        form.setValue('tipMode', 'PERCENT');
                        form.setValue('tipValue', String(percent));
                      }}
                    >
                      {percent} %
                    </button>
                  ))}
                </div>
              </div>
              <div className="charge-preview" aria-live="polite">
                <span>Calculado</span>
                <strong>{formatMoney(totalCents, currency)}</strong>
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
            {tags.data && tags.data.length > 0 && (
              <fieldset>
                <legend>Etiquetas <span className="optional">Máximo 10</span></legend>
                <div className="participant-list">
                  {tags.data.map((tag) => (
                    <label key={tag.id}>
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag.id)}
                        onChange={(event) =>
                          setSelectedTags((current) =>
                            event.target.checked
                              ? current.length >= 10 ? current : [...current, tag.id]
                              : current.filter((id) => id !== tag.id),
                          )
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </fieldset>
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
                    <label>
                      <input type="radio" value="PERCENT" {...form.register('splitMode')} />
                      <span>Porcentaje</span>
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
                              ) : splitMode === 'PERCENT' ? (
                                <input
                                  aria-label={`Porcentaje de ${label}`}
                                  aria-describedby="percentage-error"
                                  aria-invalid={
                                    splitMode === 'PERCENT' && percentageTotalBps !== 10_000
                                  }
                                  inputMode="decimal"
                                  placeholder="0.00 %"
                                  value={percentageValues[participant.id] ?? ''}
                                  onChange={(change) =>
                                    setPercentageValues((current) => ({
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
                  {splitMode === 'PERCENT' && (
                    <div className="percentage-total" aria-live="polite">
                      <strong>Suma: {(percentageTotalBps / 100).toFixed(2)} % / 100.00 %</strong>
                      {selected.length > 0 && percentageTotalBps !== 10_000 && (
                        <p className="form-field-error" role="alert" id="percentage-error">
                          Los porcentajes deben sumar exactamente 100 %.
                        </p>
                      )}
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
          <p>
            Subtotal {formatMoney(subtotalCents, currency)} · Impuesto{' '}
            {formatMoney(taxCents, currency)} · Propina {formatMoney(tipCents, currency)}
          </p>
          <h2>Por persona</h2>
          {personBreakdown.length === 0 ? (
            <p className="muted">Aún no hay personas asignadas.</p>
          ) : (
            <ul className="split-person-summary">
              {personBreakdown.map((share) => (
                <li key={share.eventParticipantId} className="person-breakdown">
                  <span>
                    {participantLabel(
                      participants.find(
                        (participant) => participant.id === share.eventParticipantId,
                      )!,
                    )}
                  </span>
                  <div>
                    <small>Subtotal {formatMoney(share.shareCents, currency)}</small>
                    <small>Impuesto {formatMoney(share.taxCents, currency)}</small>
                    <small>Propina {formatMoney(share.tipCents, currency)}</small>
                    <strong>Total {formatMoney(share.totalCents, currency)}</strong>
                  </div>
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
                {splitMode === 'PERCENT'
                  ? 'Los porcentajes se convierten a puntos básicos y el servidor conserva cada centavo.'
                  : 'El reparto se envía como EXACT con el resultado calculado para cada persona.'}
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
      eyebrow={
        expense.data.splitMode === 'EQUAL'
          ? 'Partes iguales'
          : expense.data.splitMode === 'PERCENT'
            ? 'Por porcentaje'
            : 'Montos exactos'
      }
      title={expense.data.title}
    >
      <section className="expense-detail glass-panel">
        <div className="expense-total">
          <span>Total</span>
          <strong>{formatMoney(expense.data.totalCents, expense.data.currency)}</strong>
        </div>
        <div className="expense-breakdown" aria-label="Desglose del gasto">
          <span>Subtotal {formatMoney(expense.data.subtotalCents, expense.data.currency)}</span>
          <span>Impuesto {formatMoney(expense.data.taxCents, expense.data.currency)}</span>
          <span>Propina {formatMoney(expense.data.tipCents, expense.data.currency)}</span>
        </div>
        {expense.data.notes && <p className="muted">{expense.data.notes}</p>}
        <h2>Reparto</h2>
        <ul>
          {expense.data.participants.map((participant) => (
            <li key={participant.id}>
              <span>
                {labelFor(participant.eventParticipantId, participant.eventParticipant.guestName)}
              </span>
              <div className="person-breakdown-values">
                <small>
                  Subtotal {formatMoney(participant.subtotalCents, expense.data.currency)}
                </small>
                <small>Impuesto {formatMoney(participant.taxCents, expense.data.currency)}</small>
                <small>Propina {formatMoney(participant.tipCents, expense.data.currency)}</small>
                <strong>Total {formatMoney(participant.shareCents, expense.data.currency)}</strong>
              </div>
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
