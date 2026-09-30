import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import type { Budget } from '../api/module-schemas';
import { modulesApi } from '../api/modules-api';
import { queries } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { GroupTabs } from '../components/GroupTabs';
import {
  ErrorMessage,
  ErrorState,
  FieldError,
  formatDate,
  Icon,
  LoadingState,
  ProgressBar,
  StatusPanel,
} from '../components/ui';
import { formatMoney, parseMoneyToCents } from '../domain/money';
import { normalizeText } from '../domain/validation';
import { PageHeader } from './GroupPages';

const periodLabel: Record<Budget['period'], string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  YEARLY: 'Anual',
  CUSTOM: 'Personalizado',
};
const alertTone = { OK: 'ok', WARNING: 'warning', EXCEEDED: 'danger' } as const;
const alertLabel = { OK: 'En rango', WARNING: 'Cerca del límite', EXCEEDED: 'Excedido' } as const;

/** Categorías del grupo: base de presupuestos y estadísticas por rubro. */
export function CategoryManager({ groupId, canManage }: { groupId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const categories = useQuery(moduleQueries.categories(groupId));
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: moduleKeys.categories(groupId) });
  const create = useMutation({
    mutationFn: (value: string) => modulesApi.createCategory(groupId, { name: value }),
    onSuccess: () => {
      setName('');
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (categoryId: string) => modulesApi.deleteCategory(groupId, categoryId),
    onSuccess: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeText(name);
    if (value.length < 1 || value.length > 80) return setError('Escribe entre 1 y 80 caracteres.');
    setError(undefined);
    create.mutate(value);
  };
  return (
    <section className="members-card glass-panel category-card">
      <h2>Categorías</h2>
      {categories.isPending && <p aria-busy="true">Cargando categorías…</p>}
      {categories.isError && <ErrorMessage error={categories.error} />}
      {categories.data?.length === 0 && (
        <p className="muted">
          Sin categorías todavía.{' '}
          {canManage ? 'Crea algunas para ordenar gastos y presupuestos.' : ''}
        </p>
      )}
      {categories.data && categories.data.length > 0 && (
        <ul className="chip-list" aria-label="Categorías del grupo">
          {categories.data.map((category) => (
            <li key={category.id} className="chip">
              <span>{category.name}</span>
              {canManage && (
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`Eliminar categoría ${category.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Eliminar «${category.name}»? Los gastos quedarán sin categoría.`,
                      )
                    )
                      remove.mutate(category.id);
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form className="inline-entry" onSubmit={submit} noValidate>
          <label htmlFor="category-name" className="sr-only">
            Nueva categoría
          </label>
          <input
            id="category-name"
            placeholder="Nueva categoría"
            value={name}
            maxLength={80}
            aria-describedby="category-name-error"
            onChange={(event) => setName(event.target.value)}
          />
          <Button variant="tertiary" type="submit" isDisabled={create.isPending}>
            Añadir
          </Button>
        </form>
      )}
      <FieldError id="category-name-error" message={error} />
      {(create.isError || remove.isError) && <ErrorMessage error={create.error ?? remove.error} />}
    </section>
  );
}

function BudgetCard({
  budget,
  canManage,
  onDelete,
  deleting,
}: {
  budget: Budget;
  canManage: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { current } = budget;
  return (
    <article className="budget-card glass-panel">
      <header>
        <div>
          <h2>{budget.name}</h2>
          <small>
            {periodLabel[budget.period]}
            {budget.category ? ` · ${budget.category.name}` : ' · Todas las categorías'}
          </small>
        </div>
        <span className={`status-chip alert-${current.alert.toLowerCase()}`}>
          {alertLabel[current.alert]}
        </span>
      </header>
      <p className="budget-amounts">
        <strong>{formatMoney(current.spentCents, budget.currency)}</strong>
        <span> de {formatMoney(budget.amountCents, budget.currency)}</span>
      </p>
      <ProgressBar
        value={current.progressPercent}
        tone={alertTone[current.alert]}
        label={`${budget.name}: ${current.progressPercent}% usado`}
      />
      <footer>
        <small>
          {current.overspentCents > 0
            ? `Excedido por ${formatMoney(current.overspentCents, budget.currency)}`
            : `Disponible ${formatMoney(current.remainingCents, budget.currency)}`}{' '}
          · {current.expenseCount} gastos · {formatDate(current.periodStart)} –{' '}
          {formatDate(new Date(new Date(current.periodEnd).getTime() - 1).toISOString())}
        </small>
        {canManage && (
          <Button
            variant="danger-soft"
            size="sm"
            type="button"
            isDisabled={deleting}
            onPress={onDelete}
            aria-label={`Eliminar presupuesto ${budget.name}`}
          >
            Eliminar
          </Button>
        )}
      </footer>
    </article>
  );
}

type BudgetDraft = {
  name: string;
  amount: string;
  period: Budget['period'];
  startsAt: string;
  endsAt: string;
  categoryId: string;
  threshold: string;
};

function startOfMonthInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function dateInputToIso(value: string): string {
  // Fecha local a medianoche; la API trabaja en UTC y lo documenta.
  return new Date(`${value}T00:00:00`).toISOString();
}

function BudgetForm({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const categories = useQuery(moduleQueries.categories(groupId));
  const [draft, setDraft] = useState<BudgetDraft>({
    name: '',
    amount: '',
    period: 'MONTHLY',
    startsAt: startOfMonthInput(),
    endsAt: '',
    categoryId: '',
    threshold: '80',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof BudgetDraft, string>>>({});
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof modulesApi.createBudget>[1]) =>
      modulesApi.createBudget(groupId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moduleKeys.budgets(groupId) });
      onDone();
    },
  });
  const set = (key: keyof BudgetDraft) => (value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    const name = normalizeText(draft.name);
    const amountCents = parseMoneyToCents(draft.amount);
    const threshold = Number(draft.threshold);
    if (name.length < 2 || name.length > 120)
      next.name = 'El nombre debe tener 2 a 120 caracteres.';
    if (amountCents === null) next.amount = 'Usa un monto positivo con máximo dos decimales.';
    if (!draft.startsAt) next.startsAt = 'Selecciona la fecha de inicio.';
    if (draft.period === 'CUSTOM' && !draft.endsAt)
      next.endsAt = 'El periodo personalizado necesita fin.';
    if (draft.endsAt && draft.startsAt && draft.endsAt <= draft.startsAt)
      next.endsAt = 'La fecha final debe ser posterior al inicio.';
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100)
      next.threshold = 'Usa un porcentaje entre 1 y 100.';
    setErrors(next);
    if (Object.keys(next).length > 0 || amountCents === null) return;
    mutation.mutate({
      name,
      amountCents,
      period: draft.period,
      startsAt: dateInputToIso(draft.startsAt),
      ...(draft.endsAt ? { endsAt: dateInputToIso(draft.endsAt) } : {}),
      ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
      alertThresholdPercent: threshold,
    });
  };
  return (
    <section className="form-card glass-panel">
      <h2>Nuevo presupuesto</h2>
      <form onSubmit={submit} noValidate>
        <label htmlFor="budget-name">Nombre</label>
        <input
          id="budget-name"
          value={draft.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="budget-name-error"
          onChange={(event) => set('name')(event.target.value)}
        />
        <FieldError id="budget-name-error" message={errors.name} />
        <div className="field-pair">
          <div>
            <label htmlFor="budget-amount">Límite</label>
            <input
              id="budget-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={draft.amount}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby="budget-amount-error"
              onChange={(event) => set('amount')(event.target.value)}
            />
            <FieldError id="budget-amount-error" message={errors.amount} />
          </div>
          <div>
            <label htmlFor="budget-period">Periodo</label>
            <select
              id="budget-period"
              value={draft.period}
              onChange={(event) => set('period')(event.target.value)}
            >
              {Object.entries(periodLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-pair even">
          <div>
            <label htmlFor="budget-start">Inicio</label>
            <input
              id="budget-start"
              type="date"
              value={draft.startsAt}
              aria-describedby="budget-start-error"
              onChange={(event) => set('startsAt')(event.target.value)}
            />
            <FieldError id="budget-start-error" message={errors.startsAt} />
          </div>
          <div>
            <label htmlFor="budget-end">
              Fin {draft.period !== 'CUSTOM' && <span className="optional">Opcional</span>}
            </label>
            <input
              id="budget-end"
              type="date"
              value={draft.endsAt}
              aria-describedby="budget-end-error"
              onChange={(event) => set('endsAt')(event.target.value)}
            />
            <FieldError id="budget-end-error" message={errors.endsAt} />
          </div>
        </div>
        <div className="field-pair even">
          <div>
            <label htmlFor="budget-category">Categoría</label>
            <select
              id="budget-category"
              value={draft.categoryId}
              onChange={(event) => set('categoryId')(event.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="budget-threshold">Avisar al llegar a (%)</label>
            <input
              id="budget-threshold"
              type="number"
              min={1}
              max={100}
              value={draft.threshold}
              aria-describedby="budget-threshold-error"
              onChange={(event) => set('threshold')(event.target.value)}
            />
            <FieldError id="budget-threshold-error" message={errors.threshold} />
          </div>
        </div>
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <div className="button-row">
          <Button variant="primary" type="submit" isDisabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Crear presupuesto'}
          </Button>
          <Button variant="tertiary" type="button" onPress={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Presupuestos del grupo con el consumo real del periodo vigente. */
export function BudgetsPage() {
  const { groupId = '' } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const budgets = useQuery(moduleQueries.budgets(groupId));
  const [creating, setCreating] = useState(false);
  const canManage = ['OWNER', 'ADMIN'].includes(group.data?.currentRole ?? '');
  const remove = useMutation({
    mutationFn: (budgetId: string) => modulesApi.deleteBudget(groupId, budgetId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: moduleKeys.budgets(groupId) }),
  });
  return (
    <PageHeader
      eyebrow={group.data?.name ?? 'Grupo'}
      title="Presupuestos"
      action={
        canManage && !creating ? (
          <Button variant="primary" type="button" onPress={() => setCreating(true)}>
            <Icon name="plus" /> Nuevo presupuesto
          </Button>
        ) : undefined
      }
    >
      <GroupTabs groupId={groupId} />
      {creating && <BudgetForm groupId={groupId} onDone={() => setCreating(false)} />}
      {budgets.isPending && <LoadingState title="Cargando presupuestos" />}
      {budgets.isError && (
        <ErrorState
          title="No pudimos cargar los presupuestos"
          error={budgets.error}
          onRetry={() => void budgets.refetch()}
        />
      )}
      {budgets.data?.length === 0 && !creating && (
        <StatusPanel title="Sin presupuestos">
          <p>
            {canManage
              ? 'Define un límite por periodo y Cabales avisará al acercarse.'
              : 'Quien administra el grupo puede definir límites de gasto.'}
          </p>
        </StatusPanel>
      )}
      {remove.isError && <ErrorMessage error={remove.error} />}
      {budgets.data && budgets.data.length > 0 && (
        <div className="card-grid budgets">
          {budgets.data.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              canManage={canManage}
              deleting={remove.isPending}
              onDelete={() => {
                if (window.confirm(`¿Eliminar el presupuesto «${budget.name}»?`))
                  remove.mutate(budget.id);
              }}
            />
          ))}
        </div>
      )}
    </PageHeader>
  );
}
