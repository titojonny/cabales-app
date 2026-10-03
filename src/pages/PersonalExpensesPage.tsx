import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { modulesApi } from '../api/modules-api';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import { useAuth } from '../auth/AuthProvider';
import { ErrorMessage, StatusPanel } from '../components/ui';
import { formatMoney, parseMoneyToCents } from '../domain/money';
import { PageHeader } from './GroupPages';

function localDateTime() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Sección personal: alta rápida, filtros, total del periodo y gestión de recurrencias. */
export function PersonalExpensesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [tagId, setTagId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [occurredAt, setOccurredAt] = useState(localDateTime);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [recurringTitle, setRecurringTitle] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY'>(
    'MONTHLY',
  );
  const [recurringDay, setRecurringDay] = useState('1');
  const [recurringNextRun, setRecurringNextRun] = useState(localDateTime);
  const [notice, setNotice] = useState<string>();
  const dateBoundary = (value: string, end = false) =>
    value
      ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString()
      : undefined;
  const filters = {
    ...(from || to
      ? {
          ...(from ? { from: dateBoundary(from) } : {}),
          ...(to ? { to: dateBoundary(to, true) } : {}),
        }
      : { month }),
    scope: 'PERSONAL' as const,
    ...(text ? { text } : {}),
    ...(tagId ? { tagId } : {}),
    ...(categoryId ? { categoryId } : {}),
    limit: 50,
  };
  const expenses = useQuery({
    ...moduleQueries.personalExpenses(filters),
    enabled: Boolean(session),
  });
  const tags = useQuery({ ...moduleQueries.personalTags(), enabled: Boolean(session) });
  const categories = useQuery({ ...moduleQueries.personalCategories(), enabled: Boolean(session) });
  const recurring = useQuery({ ...moduleQueries.personalRecurring(), enabled: Boolean(session) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: moduleKeys.personalRecurring });
    void queryClient.invalidateQueries({ queryKey: moduleKeys.personalTags });
    void queryClient.invalidateQueries({ queryKey: moduleKeys.personalCategories });
  };
  const createTag = useMutation({
    mutationFn: () => {
      if (!newTag.trim()) throw new Error('Escribe un nombre para la etiqueta.');
      return modulesApi.createPersonalTag(newTag.trim());
    },
    onSuccess: () => {
      setNewTag('');
      setNotice('Etiqueta creada.');
      refresh();
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : 'No se pudo crear la etiqueta.'),
  });
  const createCategory = useMutation({
    mutationFn: () => {
      if (!newCategory.trim()) throw new Error('Escribe un nombre para la categoria.');
      return modulesApi.createPersonalCategory({ name: newCategory.trim() });
    },
    onSuccess: () => {
      setNewCategory('');
      setNotice('Categoria creada.');
      refresh();
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : 'No se pudo crear la categoria.'),
  });
  const createExpense = useMutation({
    mutationFn: () => {
      const cents = parseMoneyToCents(amount);
      if (!title.trim() || cents === null || cents <= 0)
        throw new Error('Escribe un título y un importe válido.');
      return modulesApi.createPersonalExpense(
        {
          title: title.trim(),
          totalCents: cents,
          currency,
          occurredAt: new Date(occurredAt).toISOString(),
          ...(categoryId ? { categoryId } : {}),
          tagIds: selectedTags,
        },
        crypto.randomUUID(),
      );
    },
    onSuccess: () => {
      setTitle('');
      setAmount('');
      setNotice('Gasto personal guardado.');
      refresh();
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el gasto.'),
  });
  const createRecurring = useMutation({
    mutationFn: () => {
      const cents = parseMoneyToCents(recurringAmount);
      if (!recurringTitle.trim() || cents === null || cents <= 0)
        throw new Error('Completa el nombre y el importe recurrente.');
      return modulesApi.createPersonalRecurring({
        title: recurringTitle.trim(),
        amountCents: cents,
        currency,
        frequency: recurringFrequency,
        chargeDay: Number(recurringDay),
        nextRunAt: new Date(recurringNextRun).toISOString(),
        ...(categoryId ? { categoryId } : {}),
        tagIds: selectedTags,
      });
    },
    onSuccess: () => {
      setRecurringTitle('');
      setRecurringAmount('');
      setNotice('Recurrente creado.');
      refresh();
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : 'No se pudo crear el recurrente.'),
  });
  if (expenses.isPending || tags.isPending || categories.isPending || recurring.isPending)
    return (
      <StatusPanel title="Cargando Mis gastos">
        <p>Consultando tus gastos reales…</p>
      </StatusPanel>
    );
  if (expenses.isError || tags.isError || categories.isError || recurring.isError)
    return (
      <StatusPanel title="No pudimos cargar Mis gastos">
        <ErrorMessage error={expenses.error || tags.error || categories.error || recurring.error} />
      </StatusPanel>
    );
  const items = expenses.data.data;
  const total = expenses.data.meta.total ?? items.reduce((sum, item) => sum + item.totalCents, 0);
  return (
    <>
      <PageHeader eyebrow="Finanzas personales" title="Mis gastos">
        <p className="page-intro">
          Registra y consulta únicamente tus gastos personales. Los gastos de grupo siguen en su
          grupo.
        </p>
      </PageHeader>
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
      <section className="glass-panel form-card" aria-labelledby="quick-expense-title">
        <h2 id="quick-expense-title">Alta rápida</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createExpense.mutate();
          }}
        >
          <label htmlFor="personal-title">Concepto</label>
          <input
            id="personal-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            required
          />
          <div className="field-pair">
            <div>
              <label htmlFor="personal-amount">Importe</label>
              <input
                id="personal-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label htmlFor="personal-currency">Moneda</label>
              <input
                id="personal-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </div>
          </div>
          <label htmlFor="personal-date">Fecha</label>
          <input
            id="personal-date"
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
            required
          />
          <label htmlFor="personal-category">Categoria</label>
          <select
            id="personal-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Sin categoria</option>
            {categories.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {tags.data.length > 0 && (
            <fieldset>
              <legend>Etiquetas</legend>
              <div className="participant-list">
                {tags.data.map((tag) => (
                  <label key={tag.id}>
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      disabled={!selectedTags.includes(tag.id) && selectedTags.length >= 10}
                      onChange={(event) =>
                        setSelectedTags((current) =>
                          event.target.checked
                            ? [...current, tag.id]
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
          <div className="field-pair">
            <div>
              <label htmlFor="new-personal-tag">Nueva etiqueta</label>
              <input
                id="new-personal-tag"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                maxLength={50}
              />
            </div>
            <div className="field-action">
              <Button
                type="button"
                variant="tertiary"
                onPress={() => createTag.mutate()}
                isDisabled={createTag.isPending}
              >
                {createTag.isPending ? 'Creando…' : 'Crear etiqueta'}
              </Button>
            </div>
          </div>
          <Button type="submit" variant="primary" isDisabled={createExpense.isPending}>
            {createExpense.isPending ? 'Guardando…' : 'Guardar gasto'}
          </Button>
        </form>
        <div className="field-pair">
          <div>
            <label htmlFor="new-personal-category">Nueva categoria</label>
            <input
              id="new-personal-category"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="field-action">
            <Button
              type="button"
              variant="tertiary"
              onPress={() => createCategory.mutate()}
              isDisabled={createCategory.isPending}
            >
              {createCategory.isPending ? 'Creando...' : 'Crear categoria'}
            </Button>
          </div>
        </div>
      </section>
      <section className="glass-panel" aria-labelledby="history-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Historial</span>
            <h2 id="history-title">Gastos filtrados</h2>
          </div>
          <strong>{formatMoney(total, currency)}</strong>
        </div>
        <div className="field-pair filters-row">
          <div>
            <label htmlFor="expense-month">Mes</label>
            <input
              id="expense-month"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setFrom('');
                setTo('');
              }}
            />
          </div>
          <div>
            <label htmlFor="expense-from">Desde</label>
            <input
              id="expense-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="expense-to">Hasta</label>
            <input
              id="expense-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="expense-search">Texto</label>
            <input
              id="expense-search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Buscar concepto"
            />
          </div>
          <div>
            <label htmlFor="expense-category-filter">Categoria</label>
            <select
              id="expense-category-filter"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Todas</option>
              {categories.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="expense-tag-filter">Etiqueta</label>
            <select
              id="expense-tag-filter"
              value={tagId}
              onChange={(event) => setTagId(event.target.value)}
            >
              <option value="">Todas</option>
              {tags.data.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="empty-state">No hay gastos en este filtro.</p>
        ) : (
          <ul className="card-list">
            {items.map((item) => (
              <li key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <small>{new Date(item.occurredAt).toLocaleDateString('es')}</small>
                  {item.tags.length > 0 && (
                    <small>{item.tags.map(({ tag }) => tag.name).join(' · ')}</small>
                  )}
                </div>
                <strong>{formatMoney(item.totalCents, item.currency)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="glass-panel" aria-labelledby="recurring-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Automatización</span>
            <h2 id="recurring-title">Gastos recurrentes</h2>
          </div>
        </div>
        <form
          className="form-card"
          onSubmit={(event) => {
            event.preventDefault();
            createRecurring.mutate();
          }}
        >
          <label htmlFor="recurring-category">Categoria</label>
          <select
            id="recurring-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Sin categoria</option>
            {categories.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label htmlFor="recurring-name">Concepto recurrente</label>
          <input
            id="recurring-name"
            value={recurringTitle}
            onChange={(event) => setRecurringTitle(event.target.value)}
            required
          />
          <div className="field-pair">
            <div>
              <label htmlFor="recurring-amount">Importe</label>
              <input
                id="recurring-amount"
                inputMode="decimal"
                value={recurringAmount}
                onChange={(event) => setRecurringAmount(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="recurring-frequency">Frecuencia</label>
              <select
                id="recurring-frequency"
                value={recurringFrequency}
                onChange={(event) =>
                  setRecurringFrequency(event.target.value as typeof recurringFrequency)
                }
              >
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>
          </div>
          <div className="field-pair">
            <div>
              <label htmlFor="recurring-day">Día de cobro</label>
              <input
                id="recurring-day"
                type="number"
                min={1}
                max={recurringFrequency === 'WEEKLY' ? 7 : 31}
                value={recurringDay}
                onChange={(event) => setRecurringDay(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="recurring-next">Próxima fecha</label>
              <input
                id="recurring-next"
                type="datetime-local"
                value={recurringNextRun}
                onChange={(event) => setRecurringNextRun(event.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" variant="secondary" isDisabled={createRecurring.isPending}>
            {createRecurring.isPending ? 'Creando…' : 'Crear recurrente'}
          </Button>
        </form>
        {recurring.data.length === 0 ? (
          <p className="empty-state">Todavía no tienes gastos recurrentes.</p>
        ) : (
          <ul className="card-list">
            {recurring.data.map((item) => (
              <li key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {formatMoney(item.amountCents, item.currency)} · Próximo:{' '}
                    {new Date(item.nextRunAt).toLocaleDateString('es')}
                  </small>
                  <small>{item.isActive ? 'Activo' : 'Pausado'}</small>
                </div>
                <div className="button-row">
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() =>
                      (item.isActive
                        ? modulesApi.pausePersonalRecurring(item.id)
                        : modulesApi.resumePersonalRecurring(item.id)
                      ).then(refresh)
                    }
                  >
                    {item.isActive ? 'Pausar' : 'Reanudar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => modulesApi.deletePersonalRecurring(item.id).then(refresh)}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
