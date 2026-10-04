import { Button } from '@heroui/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import type { FundDetail, FundMovementType } from '../api/module-schemas';
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
  StatusPanel,
} from '../components/ui';
import { formatMoney, parseMoneyToCents } from '../domain/money';
import { normalizeText } from '../domain/validation';
import { PageHeader } from './GroupPages';

const movementLabel: Record<FundMovementType, string> = {
  CONTRIBUTION: 'Aporte',
  WITHDRAWAL: 'Retiro',
  ADJUSTMENT: 'Ajuste',
};

function CreateFundForm({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const mutation = useMutation({
    mutationFn: () =>
      modulesApi.createFund(groupId, {
        name: normalizeText(name),
        ...(normalizeText(description) ? { description: normalizeText(description) } : {}),
        memberIds,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moduleKeys.funds(groupId) });
      onDone();
    },
  });
  const others = (group.data?.members ?? []).filter(
    (member) => member.id !== group.data?.currentMemberId,
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = normalizeText(name);
    if (clean.length < 2 || clean.length > 120)
      return setError('El nombre debe tener 2 a 120 caracteres.');
    setError(undefined);
    mutation.mutate();
  };
  return (
    <section className="form-card glass-panel">
      <h2>Nuevo fondo</h2>
      <form onSubmit={submit} noValidate>
        <label htmlFor="fund-name">Nombre</label>
        <input
          id="fund-name"
          value={name}
          aria-invalid={Boolean(error)}
          aria-describedby="fund-name-error"
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="fund-name-error" message={error} />
        <label htmlFor="fund-description">
          Descripción <span className="optional">Opcional</span>
        </label>
        <textarea
          id="fund-description"
          rows={2}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {others.length > 0 && (
          <fieldset>
            <legend>Integrantes del fondo</legend>
            <p className="muted">Tú quedas como gestor. Elige quién más puede aportar.</p>
            <div className="participant-list">
              {others.map((member) => (
                <label key={member.id} className="participant">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(member.id)}
                    onChange={(event) =>
                      setMemberIds((previous) =>
                        event.target.checked
                          ? [...previous, member.id]
                          : previous.filter((value) => value !== member.id),
                      )
                    }
                  />
                  <span>{member.user?.displayName ?? 'Integrante'}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {mutation.isError && <ErrorMessage error={mutation.error} />}
        <div className="button-row">
          <Button variant="primary" type="submit" isDisabled={mutation.isPending}>
            {mutation.isPending ? 'Creando…' : 'Crear fondo'}
          </Button>
          <Button variant="tertiary" type="button" onPress={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

function CreateContributionRequestForm({
  groupId,
  fundId,
  data,
  onDone,
}: {
  groupId: string;
  fundId: string;
  data: FundDetail;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [dueAt, setDueAt] = useState(() => localDateTimeInput(24 * 60 * 60 * 1000));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const create = useMutation({
    mutationFn: () =>
      modulesApi.createFundContributionRequest(groupId, fundId, {
        dueAt: new Date(dueAt).toISOString(),
        members: data.members.map((member) => ({
          fundMemberId: member.id,
          amountCents: parseMoneyToCents(amounts[member.id] ?? '') ?? 0,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moduleKeys.fund(groupId, fundId) });
      onDone();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const members = data.members.map((member) => ({
      fundMemberId: member.id,
      amountCents: parseMoneyToCents(amounts[member.id] ?? ''),
    }));
    if (!dueAt || Number.isNaN(new Date(dueAt).getTime()))
      return setError('Indica una fecha limite.');
    if (members.some((member) => member.amountCents === null || member.amountCents <= 0))
      return setError('Indica un importe positivo para cada integrante.');
    setError(undefined);
    create.mutate();
  };
  return (
    <section className="form-card glass-panel">
      <h2>Nueva solicitud de aporte</h2>
      <p className="muted small">
        El importe se guarda por integrante y cada persona ve su estado.
      </p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="contribution-due-at">Fecha limite</label>
        <input
          id="contribution-due-at"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
        <fieldset>
          <legend>Importe por integrante ({data.currency})</legend>
          {data.members.map((member) => (
            <label key={member.id} className="field-pair even">
              <span>{member.user.displayName}</span>
              <input
                aria-label={`Importe para ${member.user.displayName}`}
                inputMode="decimal"
                placeholder="0.00"
                value={amounts[member.id] ?? ''}
                onChange={(event) =>
                  setAmounts((current) => ({ ...current, [member.id]: event.target.value }))
                }
              />
            </label>
          ))}
        </fieldset>
        <FieldError id="contribution-request-error" message={error} />
        {create.isError && <ErrorMessage error={create.error} />}
        <div className="button-row">
          <Button variant="primary" type="submit" isDisabled={create.isPending}>
            Crear solicitud
          </Button>
          <Button variant="tertiary" type="button" onPress={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

function localDateTimeInput(offsetMs: number): string {
  const value = new Date(Date.now() + offsetMs);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Fondos comunes del grupo; el saldo siempre se deriva de movimientos. */
export function FundsPage() {
  const { groupId = '' } = useParams();
  const { session } = useAuth();
  const group = useQuery(queries.group(groupId, session?.user.id ?? ''));
  const funds = useQuery(moduleQueries.funds(groupId));
  const [creating, setCreating] = useState(false);
  return (
    <PageHeader
      eyebrow={group.data?.name ?? 'Grupo'}
      title="Fondos"
      action={
        !creating ? (
          <Button variant="primary" type="button" onPress={() => setCreating(true)}>
            <Icon name="plus" /> Nuevo fondo
          </Button>
        ) : undefined
      }
    >
      <GroupTabs groupId={groupId} />
      {creating && <CreateFundForm groupId={groupId} onDone={() => setCreating(false)} />}
      {funds.isPending && <LoadingState title="Cargando fondos" />}
      {funds.isError && (
        <ErrorState
          title="No pudimos cargar los fondos"
          error={funds.error}
          onRetry={() => void funds.refetch()}
        />
      )}
      {funds.data?.length === 0 && !creating && (
        <StatusPanel title="Sin fondos">
          <p>Un fondo reúne aportes para gastos comunes, como una caja de viaje.</p>
        </StatusPanel>
      )}
      {funds.data && funds.data.length > 0 && (
        <div className="card-grid">
          {funds.data.map((fund) => (
            <Link
              key={fund.id}
              className={`group-card glass-panel ${fund.archivedAt ? 'archived' : ''}`}
              to={`/app/groups/${groupId}/funds/${fund.id}`}
            >
              <span className="card-index">{fund.archivedAt ? 'Archivado' : 'Activo'}</span>
              <div>
                <h2>{fund.name}</h2>
                <p>{fund.description || 'Sin descripción'}</p>
              </div>
              <footer>
                <span>
                  {fund.memberCount ?? '—'} integrantes · {fund.movementCount ?? 0} movimientos
                </span>
                <strong>{formatMoney(fund.balanceCents, fund.currency)}</strong>
              </footer>
            </Link>
          ))}
        </div>
      )}
    </PageHeader>
  );
}

type MovementDraft = {
  type: FundMovementType;
  amount: string;
  sign: '+' | '-';
  description: string;
  contributionRequestMemberId?: string;
};

/** Detalle del fondo: saldo, integrantes, movimientos inmutables y registro de nuevos. */
export function FundDetailPage() {
  const { groupId = '', fundId = '' } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const fund = useQuery(moduleQueries.fund(groupId, fundId));
  const movements = useInfiniteQuery({
    queryKey: moduleKeys.fundMovements(groupId, fundId),
    queryFn: ({ pageParam }) => modulesApi.fundMovements(groupId, fundId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const [draft, setDraft] = useState<MovementDraft>({
    type: 'CONTRIBUTION',
    amount: '',
    sign: '+',
    description: '',
  });
  const [error, setError] = useState<string>();
  const [creatingRequest, setCreatingRequest] = useState(false);
  const attempt = useRef<{ key: string; signature: string } | undefined>(undefined);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: moduleKeys.fund(groupId, fundId) });
    void queryClient.invalidateQueries({ queryKey: moduleKeys.funds(groupId) });
  };
  const create = useMutation({
    mutationFn: (input: {
      body: Parameters<typeof modulesApi.createFundMovement>[2];
      key: string;
    }) => modulesApi.createFundMovement(groupId, fundId, input.body, input.key),
    retry: 1,
    onSuccess: () => {
      attempt.current = undefined;
      setDraft((previous) => ({ ...previous, amount: '', description: '' }));
      refresh();
    },
  });
  const archive = useMutation({
    mutationFn: () => modulesApi.archiveFund(groupId, fundId),
    onSuccess: refresh,
  });

  if (fund.isPending) return <LoadingState title="Cargando fondo" />;
  if (fund.isError)
    return (
      <ErrorState
        title="No pudimos abrir el fondo"
        error={fund.error}
        onRetry={() => void fund.refetch()}
      />
    );
  const data = fund.data;
  const allowedTypes: FundMovementType[] = [
    ...(data.canContribute ? (['CONTRIBUTION'] as const) : []),
    ...(data.canManage ? (['WITHDRAWAL', 'ADJUSTMENT'] as const) : []),
  ];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseMoneyToCents(draft.amount);
    const description = normalizeText(draft.description);
    if (cents === null) return setError('Usa un monto positivo con máximo dos decimales.');
    if (draft.type !== 'CONTRIBUTION' && description.length < 3)
      return setError('Describe el motivo con al menos 3 caracteres.');
    setError(undefined);
    const amountCents = draft.type === 'ADJUSTMENT' && draft.sign === '-' ? -cents : cents;
    const body = {
      type: draft.type,
      amountCents,
      ...(description ? { description } : {}),
      ...(draft.type === 'CONTRIBUTION' && draft.contributionRequestMemberId
        ? { contributionRequestMemberId: draft.contributionRequestMemberId }
        : {}),
    };
    // Misma llave si se reintenta el mismo movimiento; nueva llave si cambió.
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature)
      attempt.current = { key: crypto.randomUUID(), signature };
    create.mutate({ body, key: attempt.current.key });
  };
  const rows = movements.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <PageHeader
      eyebrow="Fondo"
      title={data.name}
      action={
        <Link className="button quiet" to={`/app/groups/${groupId}/funds`}>
          Volver a fondos
        </Link>
      }
    >
      <GroupTabs groupId={groupId} />
      <div className="summary-grid">
        <article className="metric-card">
          <span>Saldo</span>
          <strong>{formatMoney(data.balanceCents, data.currency)}</strong>
          <small>
            {data.archivedAt
              ? `Archivado el ${formatDate(data.archivedAt)}`
              : 'Derivado de movimientos'}
          </small>
        </article>
        <article className="metric-card">
          <span>Aportes</span>
          <strong>{formatMoney(data.totals.CONTRIBUTION?.totalCents ?? 0, data.currency)}</strong>
          <small>
            Retiros {formatMoney(data.totals.WITHDRAWAL?.totalCents ?? 0, data.currency)}
          </small>
        </article>
        <article className="members-card glass-panel">
          <h2>Integrantes</h2>
          <ul>
            {data.members.map((member) => (
              <li key={member.id}>
                <span className="avatar" aria-hidden="true">
                  {member.user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{member.user.displayName}</strong>
                  <small>{member.role === 'MANAGER' ? 'Gestor' : 'Integrante'}</small>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      {data.canManage && !data.archivedAt && (
        <>
          {!creatingRequest && (
            <Button variant="tertiary" type="button" onPress={() => setCreatingRequest(true)}>
              Solicitar aportes
            </Button>
          )}
          {creatingRequest && (
            <CreateContributionRequestForm
              groupId={groupId}
              fundId={fundId}
              data={data}
              onDone={() => setCreatingRequest(false)}
            />
          )}
        </>
      )}

      <section className="list-section" aria-labelledby="contribution-requests-title">
        <h2 id="contribution-requests-title" className="section-title">
          Solicitudes de aporte
        </h2>
        {data.contributionRequests.length === 0 && (
          <p className="muted">No hay solicitudes de aporte.</p>
        )}
        {data.contributionRequests.length > 0 && (
          <ul className="movement-list">
            {data.contributionRequests.map((request) => (
              <li key={request.id} className="glass-panel">
                <span className={`status-chip ${request.status.toLowerCase()}`}>
                  {request.status === 'PAID'
                    ? 'Pagado'
                    : request.status === 'OVERDUE'
                      ? 'Vencido'
                      : 'Pendiente'}
                </span>
                <span className="grow">
                  <strong>
                    {request.user.displayName} · {formatMoney(request.amountCents, data.currency)}
                  </strong>
                  <small>Limite: {formatDate(request.dueAt, true)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!data.archivedAt && allowedTypes.length > 0 && (
        <section className="form-card glass-panel">
          <h2>Registrar movimiento</h2>
          <form onSubmit={submit} noValidate>
            <div className="field-pair even">
              <div>
                <label htmlFor="movement-type">Tipo</label>
                <select
                  id="movement-type"
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      type: event.target.value as FundMovementType,
                    }))
                  }
                >
                  {allowedTypes.map((type) => (
                    <option key={type} value={type}>
                      {movementLabel[type]}
                    </option>
                  ))}
                </select>
                {draft.type === 'CONTRIBUTION' && (
                  <select
                    aria-label="Solicitud de aporte"
                    value={draft.contributionRequestMemberId ?? ''}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        contributionRequestMemberId: event.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">Aporte libre</option>
                    {data.contributionRequests
                      .filter(
                        (request) =>
                          request.user.id === session?.user.id && request.status !== 'PAID',
                      )
                      .map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.status === 'OVERDUE' ? 'Vencido' : 'Pendiente'} ·{' '}
                          {formatMoney(request.amountCents, data.currency)}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="movement-amount">Monto ({data.currency})</label>
                <div className="inline-entry">
                  {draft.type === 'ADJUSTMENT' && (
                    <select
                      aria-label="Sentido del ajuste"
                      value={draft.sign}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          sign: event.target.value as '+' | '-',
                        }))
                      }
                    >
                      <option value="+">Sumar</option>
                      <option value="-">Restar</option>
                    </select>
                  )}
                  <input
                    id="movement-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={draft.amount}
                    aria-describedby="movement-error"
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, amount: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
            <label htmlFor="movement-description">
              Descripción{' '}
              {draft.type === 'CONTRIBUTION' && <span className="optional">Opcional</span>}
            </label>
            <input
              id="movement-description"
              maxLength={500}
              value={draft.description}
              aria-describedby="movement-error"
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, description: event.target.value }))
              }
            />
            <FieldError id="movement-error" message={error} />
            {create.isError && <ErrorMessage error={create.error} />}
            <p className="muted small">
              Los movimientos no se editan ni se borran; corrige con un ajuste.
            </p>
            <Button variant="primary" type="submit" isDisabled={create.isPending}>
              {create.isPending ? 'Registrando…' : 'Registrar'}
            </Button>
          </form>
        </section>
      )}

      <section className="list-section">
        <h2 className="section-title">Movimientos</h2>
        {movements.isPending && <p aria-busy="true">Cargando movimientos…</p>}
        {movements.isError && <ErrorMessage error={movements.error} />}
        {!movements.isPending && rows.length === 0 && (
          <p className="muted">Aún no hay movimientos.</p>
        )}
        {rows.length > 0 && (
          <ul className="movement-list">
            {rows.map((movement) => (
              <li key={movement.id} className="glass-panel">
                <span className={`movement-type type-${movement.type.toLowerCase()}`}>
                  {movementLabel[movement.type]}
                </span>
                <span className="grow">
                  <strong>{movement.description || movementLabel[movement.type]}</strong>
                  <small>
                    {movement.createdBy?.displayName ?? 'Usuario eliminado'} ·{' '}
                    {formatDate(movement.createdAt, true)}
                  </small>
                </span>
                <strong
                  className={
                    movement.type === 'WITHDRAWAL' || movement.amountCents < 0
                      ? 'negative'
                      : 'positive'
                  }
                >
                  {movement.type === 'WITHDRAWAL' ? '−' : movement.amountCents < 0 ? '−' : '+'}
                  {formatMoney(Math.abs(movement.amountCents), data.currency)}
                </strong>
              </li>
            ))}
          </ul>
        )}
        {movements.hasNextPage && (
          <Button
            variant="tertiary"
            type="button"
            isDisabled={movements.isFetchingNextPage}
            onPress={() => void movements.fetchNextPage()}
          >
            {movements.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        )}
      </section>

      {data.canManage && !data.archivedAt && (
        <section className="danger-zone">
          <h2>Archivar fondo</h2>
          <p className="muted">Solo es posible con saldo cero. El historial se conserva.</p>
          {archive.isError && <ErrorMessage error={archive.error} />}
          <Button
            variant="danger-soft"
            type="button"
            isDisabled={archive.isPending || data.balanceCents !== 0}
            onPress={() => {
              if (window.confirm(`¿Archivar «${data.name}»?`)) archive.mutate();
            }}
          >
            Archivar
          </Button>
        </section>
      )}
    </PageHeader>
  );
}
