import { Button } from '@heroui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { moduleKeys } from '../api/module-queries';
import { modulesApi } from '../api/modules-api';
import { downloadBlob, filenameFromContentDisposition } from '../api/download';
import { queries } from '../api/queries';
import { ErrorState, LoadingState, ProgressBar, StatusPanel } from '../components/ui';
import { formatMoney } from '../domain/money';
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
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          {row.detail && <small>{row.detail}</small>}
        </li>
      ))}
    </ul>
  );
}

/** Estadísticas calculadas en servidor sobre los grupos del usuario; sin datos inventados. */
export function StatisticsPage() {
  const groups = useQuery(queries.groups());
  const [range, setRange] = useState('90');
  const [groupId, setGroupId] = useState('');
  const [currency, setCurrency] = useState('');
  // La ventana se fija al cambiar el filtro para no refetch en cada render.
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
  const exportCsv = useMutation({
    mutationFn: () => modulesApi.statisticsExport(filters),
    onSuccess: ({ blob, headers }) => {
      downloadBlob(
        blob,
        filenameFromContentDisposition(headers.get('Content-Disposition'), 'cabales-statistics.csv'),
      );
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
            {stats.data.availableCurrencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        variant="secondary"
        type="button"
        isDisabled={exportCsv.isPending}
        onPress={() => exportCsv.mutate()}
      >
        {exportCsv.isPending ? 'Exportando…' : 'Exportar CSV'}
      </Button>
      {exportCsv.isError && <span role="alert">No pudimos exportar las estadísticas. Intenta de nuevo.</span>}
      {exportCsv.isSuccess && <span aria-live="polite">CSV descargado.</span>}
    </div>
  );

  let body;
  if (stats.isPending) body = <LoadingState title="Calculando estadísticas" />;
  else if (stats.isError)
    body = (
      <ErrorState
        title="No pudimos calcular las estadísticas"
        error={stats.error}
        onRetry={() => void stats.refetch()}
      />
    );
  else if (!stats.data.currency || stats.data.totals.expenseCount === 0)
    body = (
      <StatusPanel title="Sin gastos en este periodo">
        <p>Cuando registres gastos verás aquí categorías, tendencia y presupuestos.</p>
      </StatusPanel>
    );
  else {
    const data = stats.data;
    const code = data.currency!;
    const trendMax = Math.max(1, ...data.trend.map((point) => point.totalCents));
    body = (
      <>
        <div className="summary-grid stats">
          <article className="metric-card">
            <span>Gasto total</span>
            <strong>{formatMoney(data.totals.spentCents, code)}</strong>
            <small>
              {data.totals.expenseCount} gastos · promedio{' '}
              {formatMoney(data.totals.averageExpenseCents, code)}
            </small>
          </article>
          <article className="metric-card">
            <span>Tu parte</span>
            <strong>{formatMoney(data.totals.myShareCents, code)}</strong>
            <small>Pagaste {formatMoney(data.totals.myPaidCents, code)}</small>
          </article>
        </div>
        <div className="stats-grid">
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
                      {point.period}: {formatMoney(point.totalCents, code)}
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
              currency={code}
              rows={data.byCategory.map((row) => ({
                key: row.categoryId ?? 'none',
                name: row.name,
                value: row.totalCents,
                detail: `${row.count} gastos`,
              }))}
            />
          </section>
          {!groupId && (
            <section className="glass-panel stats-card">
              <h2>Por grupo</h2>
              <BarList
                label="Gasto por grupo"
                currency={code}
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
              currency={code}
              rows={data.byPerson.map((row, index) => ({
                key: row.userId ?? `guest-${index}`,
                name: row.displayName,
                value: row.paidCents,
                detail: `Parte ${formatMoney(row.shareCents, code)}`,
              }))}
            />
          </section>
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
                      {formatMoney(budget.spentCents, code)} de{' '}
                      {formatMoney(budget.amountCents, code)}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
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
