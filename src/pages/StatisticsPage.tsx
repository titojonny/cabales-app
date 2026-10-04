import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import { modulesApi } from '../api/modules-api';
import { downloadBlob, filenameFromContentDisposition } from '../api/download';
import { queries } from '../api/queries';
import type { Statistics } from '../api/module-schemas';
import { ErrorState, LoadingState, ProgressBar, StatusPanel } from '../components/ui';
import { formatMoney, parseMoneyToCents } from '../domain/money';
import { PageHeader } from './GroupPages';

const ranges = [
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '365', label: 'Último año' },
];

function BarList({
  rows,
  currency,
  label,
}: {
  rows: Array<{ key: string; name: string; value: number; detail?: string }>;
  currency: string;
  label: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="muted">Sin datos en este periodo.</p>;
  return (
    <ul className="bar-list" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className="bar-label">
            <span className="truncate">{row.name}</span>
            <strong>{formatMoney(row.value, currency)}</strong>
          </span>
          <span className="bar-track" aria-hidden="true">
            <span style={{ width: `${Math.max(0, (row.value / max) * 100)}%` }} />
          </span>
          {row.detail && <small>{row.detail}</small>}
        </li>
      ))}
    </ul>
  );
}

function signedVariation(value: number, currency: string) {
  return `${value >= 0 ? '+' : ''}${formatMoney(value, currency)}`;
}

async function summaryPng(data: Statistics, currency: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 760;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no permite dibujar el informe.');
  context.fillStyle = '#101827';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f3f4f6';
  context.font = 'bold 32px system-ui';
  context.fillText('Cabales · Resumen de estadísticas', 48, 64);
  context.font = '20px system-ui';
  context.fillStyle = '#b7c3d4';
  context.fillText(
    `Periodo: ${data.range.from.slice(0, 10)} a ${data.range.to.slice(0, 10)}`,
    48,
    102,
  );
  const rows = [
    ['Gastos', formatMoney(data.totals.spentCents, currency)],
    ['Tu parte', formatMoney(data.totals.myShareCents, currency)],
    ['Ingresos del mes', formatMoney(data.monthlyIncomeSummary?.incomeCents ?? 0, currency)],
    ['Saldo del mes', formatMoney(data.monthlyIncomeSummary?.balanceCents ?? 0, currency)],
    ['Proyección restante*', formatMoney(data.projection?.remainingProjectionCents ?? 0, currency)],
  ];
  context.font = 'bold 24px system-ui';
  rows.forEach(([label, value], index) => {
    const x = 48 + (index % 2) * 560;
    const y = 170 + Math.floor(index / 2) * 92;
    context.fillStyle = '#27364d';
    context.fillRect(x, y - 34, 500, 70);
    context.fillStyle = '#f3f4f6';
    context.fillText(label, x + 18, y - 4);
    context.fillStyle = '#82e6bd';
    context.fillText(value, x + 18, y + 28);
  });
  context.fillStyle = '#b7c3d4';
  context.font = '18px system-ui';
  context.fillText(
    '* Estimación basada en ritmo diario y recurrentes pendientes; no es un dato real.',
    48,
    430,
  );
  context.font = 'bold 22px system-ui';
  context.fillStyle = '#f3f4f6';
  context.fillText('Variación frente al periodo anterior', 48, 485);
  context.font = '20px system-ui';
  const totalVariation = data.comparison?.total;
  context.fillText(
    totalVariation
      ? `${signedVariation(totalVariation.absoluteCents, currency)} (${totalVariation.percentage ?? 'sin base'}%)`
      : 'Sin datos de comparación',
    48,
    520,
  );
  context.fillStyle = '#b7c3d4';
  context.font = '17px system-ui';
  context.fillText('Generado desde el resumen cargado en esta sesión.', 48, 700);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear el PNG.'))),
      'image/png',
    );
  });
}

/** Estadísticas calculadas en servidor sobre los grupos del usuario; sin datos inventados. */
export function StatisticsPage() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const groups = useQuery(queries.groups());
  const [range, setRange] = useState('90');
  const [groupId, setGroupId] = useState('');
  const [currency, setCurrency] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeCategory, setIncomeCategory] = useState('');
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().slice(0, 10));
  const [incomeNote, setIncomeNote] = useState('');
  const filters = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(range) * 86_400_000);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      ...(groupId ? { groupId } : {}),
      ...(currency ? { currency } : {}),
    };
  }, [range, groupId, currency]);
  const stats = useQuery({
    queryKey: moduleKeys.statistics({ range, groupId, currency }),
    queryFn: () => modulesApi.statistics(filters),
  });
  const monthFilters = useMemo(() => {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const incomeCurrency = currency || stats.data?.currency;
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      ...(incomeCurrency ? { currency: incomeCurrency } : {}),
    };
  }, [currency, stats.data?.currency]);
  const incomes = useQuery(moduleQueries.incomes(monthFilters));
  const exportCsv = useMutation({
    mutationFn: () => modulesApi.statisticsExport(filters),
    onSuccess: ({ blob, headers }) =>
      downloadBlob(
        blob,
        filenameFromContentDisposition(
          headers.get('Content-Disposition'),
          'cabales-statistics.csv',
        ),
      ),
  });
  const exportPdf = useMutation({
    mutationFn: () => modulesApi.statisticsPdfExport(filters),
    onSuccess: ({ blob, headers }) =>
      downloadBlob(
        blob,
        filenameFromContentDisposition(
          headers.get('Content-Disposition'),
          'cabales-statistics.pdf',
        ),
      ),
  });
  const exportPng = useMutation({
    mutationFn: async () => {
      if (!stats.data?.currency) throw new Error('No hay una moneda para exportar.');
      return summaryPng(stats.data, stats.data.currency);
    },
    onSuccess: (blob) => downloadBlob(blob, 'cabales-statistics.png'),
  });
  const code = stats.data?.currency;
  const incomeCode =
    code ||
    currency ||
    groups.data?.find((group) => !groupId || group.id === groupId)?.currency ||
    '';
  const createIncome = useMutation({
    mutationFn: () => {
      const amountCents = parseMoneyToCents(incomeAmount);
      if (!amountCents || !incomeCategory.trim() || !incomeCode)
        throw new Error('Completa importe, categoría y moneda del ingreso.');
      return modulesApi.createIncome({
        amountCents,
        date: `${incomeDate}T12:00:00.000Z`,
        category: incomeCategory.trim(),
        note: incomeNote.trim() || null,
        currency: incomeCode,
      });
    },
    onSuccess: () => {
      setIncomeAmount('');
      setIncomeCategory('');
      setIncomeNote('');
      void queryClient.invalidateQueries({ queryKey: ['incomes'] });
      void stats.refetch();
    },
  });
  const controls = (
    <div className="filter-bar">
      <label>
        <span>Periodo</span>
        <select value={range} onChange={(event) => setRange(event.target.value)}>
          {ranges.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Grupo</span>
        <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="">Todos</option>
          {groups.data?.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      {stats.data && stats.data.availableCurrencies.length > 1 && (
        <label>
          <span>Moneda</span>
          <select
            value={currency || stats.data.currency || ''}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {stats.data.availableCurrencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        variant="primary"
        type="button"
        isDisabled={exportCsv.isPending}
        onPress={() => exportCsv.mutate()}
      >
        {exportCsv.isPending ? 'Exportando…' : 'Exportar CSV'}
      </Button>
      <Button
        variant="secondary"
        type="button"
        isDisabled={!code || exportPdf.isPending}
        onPress={() => exportPdf.mutate()}
      >
        {exportPdf.isPending ? 'Generando PDF…' : 'Exportar PDF'}
      </Button>
      <Button
        variant="secondary"
        type="button"
        isDisabled={!stats.data?.currency || exportPng.isPending}
        onPress={() => exportPng.mutate()}
      >
        {exportPng.isPending ? 'Generando PNG…' : 'Exportar PNG'}
      </Button>
      {(exportCsv.isError || exportPdf.isError || exportPng.isError) && (
        <span role="alert">
          No pudimos exportar el informe. Revisa la conexión e inténtalo de nuevo.
        </span>
      )}
      {exportCsv.isSuccess && <span aria-live="polite">CSV descargado.</span>}
      {exportPdf.isSuccess && <span aria-live="polite">PDF descargado.</span>}
      {exportPng.isSuccess && <span aria-live="polite">PNG descargado.</span>}
      {stats.dataUpdatedAt > 0 && (
        <small aria-live="polite">
          Última actualización:{' '}
          {new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(
            stats.dataUpdatedAt,
          )}
        </small>
      )}
    </div>
  );

  let body;
  if (stats.isPending) body = <LoadingState title="Calculando estadísticas" />;
  else if (stats.isError && !stats.data)
    body = (
      <ErrorState
        title="No pudimos calcular las estadísticas"
        error={stats.error}
        onRetry={() => void stats.refetch()}
      />
    );
  else if (!stats.data?.currency || stats.data.totals.expenseCount === 0)
    body = (
      <>
        <StatusPanel title="Sin gastos en este periodo">
          <p>Cuando registres gastos verás aquí categorías, tendencia y presupuestos.</p>
        </StatusPanel>
        {stats.data?.monthlyIncomeSummary && incomeCode && (
          <section className="glass-panel stats-card">
            <h2>Ingresos vs gastos del mes</h2>
            <p>
              Ingresos:{' '}
              <strong>
                {formatMoney(stats.data.monthlyIncomeSummary.incomeCents, incomeCode)}
              </strong>
            </p>
            <p>
              Gastos:{' '}
              <strong>
                {formatMoney(stats.data.monthlyIncomeSummary.expenseCents, incomeCode)}
              </strong>
            </p>
            <p>
              Saldo:{' '}
              <strong>
                {formatMoney(stats.data.monthlyIncomeSummary.balanceCents, incomeCode)}
              </strong>
            </p>
          </section>
        )}
        {stats.data && (
          <IncomePanel
            code={incomeCode}
            incomes={incomes.data ?? []}
            amount={incomeAmount}
            setAmount={setIncomeAmount}
            category={incomeCategory}
            setCategory={setIncomeCategory}
            date={incomeDate}
            setDate={setIncomeDate}
            note={incomeNote}
            setNote={setIncomeNote}
            onCreate={() => createIncome.mutate()}
            pending={createIncome.isPending}
            error={createIncome.error}
            online={online}
          />
        )}
      </>
    );
  else {
    const data = stats.data;
    const reportCurrency = data.currency!;
    const trendMax = Math.max(1, ...data.trend.map((point) => point.totalCents));
    const totalVariation = data.comparison?.total;
    body = (
      <>
        {stats.isError && (
          <p className="muted" role="status">
            Mostrando la última consulta disponible; no se pudo actualizar.
          </p>
        )}
        <div className="summary-grid stats">
          <article className="metric-card">
            <span>Gasto total</span>
            <strong>{formatMoney(data.totals.spentCents, reportCurrency)}</strong>
            <small>
              {data.totals.expenseCount} gastos · promedio{' '}
              {formatMoney(data.totals.averageExpenseCents, reportCurrency)}
            </small>
          </article>
          <article className="metric-card">
            <span>Tu parte</span>
            <strong>{formatMoney(data.totals.myShareCents, reportCurrency)}</strong>
            <small>Pagaste {formatMoney(data.totals.myPaidCents, reportCurrency)}</small>
          </article>
          <article className="metric-card">
            <span>Comparación</span>
            <strong>
              {totalVariation ? signedVariation(totalVariation.absoluteCents, reportCurrency) : '—'}
            </strong>
            <small>
              {totalVariation?.percentage === null
                ? 'Sin base anterior'
                : `${totalVariation?.percentage ?? 0}% frente al periodo equivalente`}
            </small>
          </article>
        </div>
        <div className="stats-grid">
          {data.projection && (
            <section className="glass-panel stats-card">
              <h2>Proyección del mes</h2>
              <p className="muted">{data.projection.methodology}</p>
              <strong>
                {formatMoney(data.projection.remainingProjectionCents, reportCurrency)}
              </strong>
              <p>
                Restante estimado · total del mes{' '}
                {formatMoney(data.projection.projectedMonthTotalCents, reportCurrency)}
              </p>
              <small>
                Ritmo diario {formatMoney(data.projection.dailyRateCents, reportCurrency)} ·
                recurrentes pendientes{' '}
                {formatMoney(data.projection.recurrentPendingCents, reportCurrency)}
              </small>
            </section>
          )}
          {data.monthlyIncomeSummary && (
            <section className="glass-panel stats-card">
              <h2>Ingresos vs gastos del mes</h2>
              <div className="income-summary">
                <p>
                  Ingresos{' '}
                  <strong>
                    {formatMoney(data.monthlyIncomeSummary.incomeCents, reportCurrency)}
                  </strong>
                </p>
                <p>
                  Gastos{' '}
                  <strong>
                    {formatMoney(data.monthlyIncomeSummary.expenseCents, reportCurrency)}
                  </strong>
                </p>
                <p>
                  Saldo{' '}
                  <strong>
                    {formatMoney(data.monthlyIncomeSummary.balanceCents, reportCurrency)}
                  </strong>
                </p>
              </div>
              <BarList
                label="Ingresos por categoría"
                currency={reportCurrency}
                rows={data.monthlyIncomeSummary.byCategory.map((item) => ({
                  key: item.category,
                  name: item.category,
                  value: item.incomeCents,
                  detail: `${item.count} registros`,
                }))}
              />
            </section>
          )}
          <section className="glass-panel stats-card">
            <h2>Tendencia {data.granularity === 'week' ? 'semanal' : 'mensual'}</h2>
            {data.trend.length === 0 ? (
              <p className="muted">Sin datos.</p>
            ) : (
              <ol className="trend-chart" aria-label="Gasto por periodo">
                {data.trend.map((point) => (
                  <li key={point.period}>
                    <span className="trend-bar" aria-hidden="true">
                      <span style={{ height: `${(point.totalCents / trendMax) * 100}%` }} />
                    </span>
                    <small>{point.period}</small>
                    <span className="sr-only">
                      {point.period}: {formatMoney(point.totalCents, reportCurrency)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="glass-panel stats-card">
            <h2>Por categoría</h2>
            <BarList
              label="Gasto por categoría"
              currency={reportCurrency}
              rows={data.byCategory.map((row) => ({
                key: row.categoryId ?? 'none',
                name: row.name,
                value: row.totalCents,
                detail: `${row.count} gastos`,
              }))}
            />
          </section>
          {data.comparison && (
            <section className="glass-panel stats-card">
              <h2>Variación por categoría</h2>
              <BarList
                label="Variación por categoría"
                currency={reportCurrency}
                rows={data.comparison.byCategory.map((row) => ({
                  key: row.categoryId ?? 'none',
                  name: row.name,
                  value: Math.abs(row.absoluteCents),
                  detail: `${signedVariation(row.absoluteCents, reportCurrency)} · ${row.percentage === null ? 'sin base' : `${row.percentage}%`}`,
                }))}
              />
            </section>
          )}
          {!groupId && (
            <section className="glass-panel stats-card">
              <h2>Por grupo</h2>
              <BarList
                label="Gasto por grupo"
                currency={reportCurrency}
                rows={data.byGroup.map((row) => ({
                  key: row.groupId,
                  name: row.name,
                  value: row.totalCents,
                }))}
              />
            </section>
          )}
          <section className="glass-panel stats-card">
            <h2>Por persona</h2>
            <BarList
              label="Pagos por persona"
              currency={reportCurrency}
              rows={data.byPerson.map((row, index) => ({
                key: row.userId ?? `guest-${index}`,
                name: row.displayName,
                value: row.paidCents,
                detail: `Parte ${formatMoney(row.shareCents, reportCurrency)}`,
              }))}
            />
          </section>
          {(data.funds?.length ?? 0) > 0 && (
            <section className="glass-panel stats-card">
              <h2>Por fondo</h2>
              <BarList
                label="Saldo por fondo"
                currency={reportCurrency}
                rows={(data.funds ?? []).map((fund) => ({
                  key: fund.fundId,
                  name: fund.name,
                  value: fund.balanceCents,
                  detail: `${fund.movementCount} movimientos`,
                }))}
              />
            </section>
          )}
          {data.budgets.length > 0 && (
            <section className="glass-panel stats-card">
              <h2>Presupuestos</h2>
              <ul className="bar-list">
                {data.budgets.map((budget) => (
                  <li key={budget.budgetId}>
                    <span className="bar-label">
                      <span className="truncate">{budget.name}</span>
                      <strong>{budget.progressPercent}%</strong>
                    </span>
                    <ProgressBar
                      value={budget.progressPercent}
                      tone={
                        budget.alert === 'EXCEEDED'
                          ? 'danger'
                          : budget.alert === 'WARNING'
                            ? 'warning'
                            : 'ok'
                      }
                      label={`${budget.name}: ${budget.progressPercent}%`}
                    />
                    <small>
                      {formatMoney(budget.spentCents, reportCurrency)} de{' '}
                      {formatMoney(budget.amountCents, reportCurrency)}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <IncomePanel
          code={reportCurrency}
          incomes={incomes.data ?? []}
          amount={incomeAmount}
          setAmount={setIncomeAmount}
          category={incomeCategory}
          setCategory={setIncomeCategory}
          date={incomeDate}
          setDate={setIncomeDate}
          note={incomeNote}
          setNote={setIncomeNote}
          onCreate={() => createIncome.mutate()}
          pending={createIncome.isPending}
          error={createIncome.error}
          online={online}
        />
      </>
    );
  }

  return (
    <PageHeader eyebrow="Estadísticas" title="Cómo se mueve tu dinero">
      {controls}
      {body}
    </PageHeader>
  );
}

function IncomePanel({
  code,
  incomes,
  amount,
  setAmount,
  category,
  setCategory,
  date,
  setDate,
  note,
  setNote,
  onCreate,
  pending,
  error,
  online,
}: {
  code: string;
  incomes: Array<{
    id: string;
    amountCents: number;
    date: string;
    category: string;
    note: string | null;
    currency: string;
  }>;
  amount: string;
  setAmount: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  onCreate: () => void;
  pending: boolean;
  error: unknown;
  online: boolean;
}) {
  return (
    <section className="glass-panel stats-card income-panel">
      <h2>Ingresos personales</h2>
      <p className="muted">
        Registra ingresos propios; no se mezclan con gastos ni documentos de grupos.
      </p>
      <div className="field-pair even">
        <label>
          <span>Importe ({code || 'moneda'})</span>
          <input
            aria-label="Importe del ingreso"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          <span>Fecha</span>
          <input
            aria-label="Fecha del ingreso"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      <div className="field-pair even">
        <label>
          <span>Categoría</span>
          <input
            aria-label="Categoría del ingreso"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={80}
          />
        </label>
        <label>
          <span>Nota (opcional)</span>
          <input
            aria-label="Nota del ingreso"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
          />
        </label>
      </div>
      <Button
        variant="primary"
        type="button"
        isDisabled={pending || !code || !online}
        onPress={onCreate}
      >
        {!online ? 'Sin conexión' : pending ? 'Guardando…' : 'Registrar ingreso'}
      </Button>
      {Boolean(error) && (
        <p role="alert">
          No pudimos guardar el ingreso. Las mutaciones no se encolan sin conexión.
        </p>
      )}
      <h3>Registros del mes</h3>
      {incomes.length === 0 ? (
        <p className="muted">Aún no hay ingresos registrados.</p>
      ) : (
        <ul className="bar-list">
          {incomes.map((income) => (
            <li key={income.id}>
              <span className="bar-label">
                <span>{income.category}</span>
                <strong>{formatMoney(income.amountCents, income.currency)}</strong>
              </span>
              <small>
                {income.date.slice(0, 10)}
                {income.note ? ` · ${income.note}` : ''}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
