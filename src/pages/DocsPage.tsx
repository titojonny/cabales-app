import { Button } from '@heroui/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { HttpError } from '../api/http';
import { moduleKeys } from '../api/module-queries';
import type { Document, OcrJob } from '../api/module-schemas';
import { modulesApi } from '../api/modules-api';
import { queries } from '../api/queries';
import {
  ErrorMessage,
  ErrorState,
  FieldError,
  formatBytes,
  formatDate,
  LoadingState,
  StatusPanel,
} from '../components/ui';
import { formatMoney } from '../domain/money';
import { PageHeader } from './GroupPages';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
/** Límite orientativo; la API aplica el definitivo (MAX_UPLOAD_BYTES). */
const MAX_BYTES = 10 * 1024 * 1024;
const accessLabel = { VIEW: 'Lectura', EDIT: 'Edición', MANAGE: 'Gestión' } as const;
const ocrStatusLabel: Record<OcrJob['status'], string> = {
  PENDING: 'En cola',
  PROCESSING: 'Leyendo',
  SUCCEEDED: 'Listo para revisar',
  FAILED: 'Falló',
};

/** Descarga mediante URL firmada de corta duración; el archivo llega como adjunto. */
async function download(document_: Document) {
  const { url } = await modulesApi.documentDownloadUrl(document_.id);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  anchor.click();
}

/** Abre una URL firmada recién emitida; nunca conserva el enlace temporal. */
async function view(document_: Document) {
  const { url } = await modulesApi.documentDownloadUrl(document_.id);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.click();
}

function UploadForm({ groups }: { groups: Array<{ id: string; name: string }> }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState<string>();
  const upload = useMutation({
    mutationFn: () => modulesApi.uploadDocument(file!, groupId ? { groupId } : {}),
    onSuccess: () => {
      setFile(undefined);
      if (input.current) input.current.value = '';
      void queryClient.invalidateQueries({ queryKey: moduleKeys.documentsRoot });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return setError('Selecciona un archivo.');
    if (!ACCEPTED.includes(file.type)) return setError('Solo se admiten PDF, JPG, PNG o WebP.');
    if (file.size > MAX_BYTES) return setError('El archivo supera 10 MB.');
    setError(undefined);
    upload.mutate();
  };
  return (
    <section className="form-card glass-panel">
      <h2>Subir documento</h2>
      <form onSubmit={submit} noValidate>
        <label htmlFor="document-file">Archivo (PDF, JPG, PNG o WebP; máx. 10 MB)</label>
        <input
          ref={input}
          id="document-file"
          type="file"
          accept={ACCEPTED.join(',')}
          aria-describedby="document-file-error"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
        <FieldError id="document-file-error" message={error} />
        <label htmlFor="document-group">Compartir con grupo</label>
        <select
          id="document-group"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
        >
          <option value="">Solo yo</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <p className="muted small">
          Los integrantes del grupo podrán verlo. Nunca se hace público y cada descarga queda
          registrada.
        </p>
        {upload.isError && <ErrorMessage error={upload.error} />}
        <Button variant="primary" type="submit" isDisabled={upload.isPending}>
          {upload.isPending ? 'Subiendo…' : 'Subir'}
        </Button>
      </form>
    </section>
  );
}

/** Lectura de comprobantes: propone datos y exige vincularlos a un gasto revisado. */
export function OcrProviderNotice({ provider }: { provider: string }) {
  if (provider !== 'local') return null;
  return (
    <p className="ocr-local-notice" role="alert">
      Esta propuesta proviene del proveedor local: son datos de prueba de desarrollo y no deben
      confirmarse como reales. Revísalos contra el comprobante antes de vincularlos.
    </p>
  );
}

function OcrPanel({ document_ }: { document_: Document }) {
  const queryClient = useQueryClient();
  const jobs = useQuery({
    queryKey: moduleKeys.ocrJobs(document_.id),
    queryFn: () => modulesApi.ocrJobs(document_.id),
    // Sondeo solo mientras hay trabajos en curso.
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === 'PENDING' || job.status === 'PROCESSING')
        ? 3000
        : false,
  });
  const expenses = useQuery({
    ...queries.expenses(document_.groupId ?? ''),
    enabled: Boolean(document_.groupId),
  });
  const [expenseId, setExpenseId] = useState('');
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: moduleKeys.ocrJobs(document_.id) });
  const start = useMutation({
    mutationFn: () => modulesApi.createOcrJob(document_.id),
    onSuccess: refresh,
  });
  const retry = useMutation({ mutationFn: modulesApi.retryOcrJob, onSuccess: refresh });
  const confirm = useMutation({
    mutationFn: (jobId: string) => modulesApi.confirmOcrJob(jobId, expenseId),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: moduleKeys.documentsRoot });
    },
  });
  const latest = jobs.data?.[0];
  const disabled = start.error instanceof HttpError && start.error.code === 'OCR_PROVIDER_DISABLED';

  return (
    <div className="ocr-panel">
      <h3>Lectura automática</h3>
      {jobs.isPending && <p aria-busy="true">Consultando…</p>}
      {jobs.isError && <ErrorMessage error={jobs.error} />}
      {!latest && !jobs.isPending && (
        <>
          <p className="muted small">
            Detecta comercio, total y fecha. Solo propone datos: tú decides a qué gasto vincularlo.
          </p>
          <Button
            variant="tertiary"
            size="sm"
            type="button"
            isDisabled={start.isPending || disabled}
            onPress={() => start.mutate()}
          >
            {start.isPending ? 'Enviando…' : 'Leer comprobante'}
          </Button>
        </>
      )}
      {start.isError && (
        <p className="form-error" role="alert">
          {disabled
            ? 'La lectura automática no está configurada en este servidor.'
            : start.error.message}
        </p>
      )}
      {latest && (
        <div aria-live="polite">
          <p>
            Estado: <strong>{ocrStatusLabel[latest.status]}</strong>
            {latest.confirmedAt && ' · vinculado a un gasto'}
          </p>
          {latest.status === 'FAILED' && (
            <>
              <p className="muted small">
                No pudimos leer el documento ({latest.errorCode ?? 'error'}).
              </p>
              {latest.canRetry && (
                <Button
                  variant="tertiary"
                  size="sm"
                  type="button"
                  isDisabled={retry.isPending}
                  onPress={() => retry.mutate(latest.id)}
                >
                  Reintentar
                </Button>
              )}
            </>
          )}
          {latest.status === 'SUCCEEDED' && latest.proposal && (
            <>
              <OcrProviderNotice provider={latest.provider} />
              <dl className="proposal">
                <div>
                  <dt>Comercio</dt>
                  <dd>{latest.proposal.merchant || '—'}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>
                    {latest.proposal.totalCents != null && latest.proposal.currency
                      ? formatMoney(latest.proposal.totalCents, latest.proposal.currency)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>
                    {latest.proposal.occurredAt ? formatDate(latest.proposal.occurredAt) : '—'}
                  </dd>
                </div>
                {latest.proposal.confidence !== undefined && (
                  <div>
                    <dt>Confianza</dt>
                    <dd>{Math.round(latest.proposal.confidence * 100)} %</dd>
                  </div>
                )}
              </dl>
              {!latest.confirmedAt && document_.groupId && (
                <div className="inline-entry">
                  <label htmlFor={`ocr-expense-${latest.id}`} className="sr-only">
                    Gasto a vincular
                  </label>
                  <select
                    id={`ocr-expense-${latest.id}`}
                    value={expenseId}
                    onChange={(event) => setExpenseId(event.target.value)}
                  >
                    <option value="">Elige el gasto revisado…</option>
                    {expenses.data?.map((expense) => (
                      <option key={expense.id} value={expense.id}>
                        {expense.title} · {formatMoney(expense.totalCents, expense.currency)}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    isDisabled={!expenseId || confirm.isPending}
                    onPress={() => confirm.mutate(latest.id)}
                  >
                    Vincular
                  </Button>
                </div>
              )}
              {!document_.groupId && (
                <p className="muted small">
                  Comparte el documento con un grupo para vincularlo a un gasto.
                </p>
              )}
            </>
          )}
          {(retry.isError || confirm.isError) && (
            <ErrorMessage error={retry.error ?? confirm.error} />
          )}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ document_, groupName }: { document_: Document; groupName?: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: moduleKeys.documentsRoot });
  const downloadMutation = useMutation({ mutationFn: () => download(document_) });
  const viewMutation = useMutation({ mutationFn: () => view(document_) });
  const rename = useMutation({
    mutationFn: (name: string) => modulesApi.renameDocument(document_.id, name),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => modulesApi.deleteDocument(document_.id),
    onSuccess: refresh,
  });
  const canEdit = document_.access !== 'VIEW';
  const error = downloadMutation.error ?? viewMutation.error ?? rename.error ?? remove.error;
  return (
    <li className="glass-panel document-row">
      <div className="document-main">
        <span className="file-type" aria-hidden="true">
          {document_.mimeType === 'application/pdf' ? 'PDF' : 'IMG'}
        </span>
        <span className="grow">
          <strong className="truncate">{document_.name}</strong>
          <small>
            {formatBytes(document_.sizeBytes)} · {document_.owner.displayName} ·{' '}
            {formatDate(document_.createdAt)} · {groupName ?? 'Privado'} ·{' '}
            {accessLabel[document_.access]}
          </small>
        </span>
      </div>
      <div className="row-actions">
        <Button
          variant="tertiary"
          size="sm"
          type="button"
          isDisabled={viewMutation.isPending}
          onPress={() => viewMutation.mutate()}
          aria-label={`Ver ${document_.name}`}
        >
          Ver
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          type="button"
          isDisabled={downloadMutation.isPending}
          onPress={() => downloadMutation.mutate()}
          aria-label={`Descargar ${document_.name}`}
        >
          Descargar
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          type="button"
          aria-expanded={expanded}
          onPress={() => setExpanded((value) => !value)}
          aria-label={`Leer comprobante ${document_.name}`}
        >
          Comprobante
        </Button>
        {canEdit && (
          <Button
            variant="tertiary"
            size="sm"
            type="button"
            onPress={() => {
              const name = window.prompt('Nuevo nombre del documento', document_.name)?.trim();
              if (name && name !== document_.name) rename.mutate(name.slice(0, 255));
            }}
            aria-label={`Renombrar ${document_.name}`}
          >
            Renombrar
          </Button>
        )}
        {document_.access === 'MANAGE' && (
          <Button
            variant="danger-soft"
            size="sm"
            type="button"
            isDisabled={remove.isPending}
            onPress={() => {
              if (window.confirm(`¿Eliminar «${document_.name}»? No se puede deshacer.`))
                remove.mutate();
            }}
            aria-label={`Eliminar ${document_.name}`}
          >
            Eliminar
          </Button>
        )}
      </div>
      {error && <ErrorMessage error={error} />}
      {expanded && <OcrPanel document_={document_} />}
    </li>
  );
}

/** Documentos privados y compartidos con grupos, con URLs firmadas y lectura asistida. */
export function DocsPage() {
  const groups = useQuery(queries.groups());
  const [groupId, setGroupId] = useState('');
  const filters = groupId ? { groupId } : {};
  const documents = useInfiniteQuery({
    queryKey: moduleKeys.documents(filters),
    queryFn: ({ pageParam }) => modulesApi.documents({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const groupNames = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const rows = documents.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <PageHeader eyebrow="Docs" title="Comprobantes y documentos">
      <div className="split-layout">
        <div>
          <div className="section-heading">
            <h2 className="section-title">Tus documentos</h2>
            <label htmlFor="docs-filter" className="sr-only">
              Filtrar por grupo
            </label>
            <select
              id="docs-filter"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              <option value="">Todos</option>
              {groups.data?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          {documents.isPending && <LoadingState title="Cargando documentos" />}
          {documents.isError && (
            <ErrorState
              title="No pudimos cargar los documentos"
              error={documents.error}
              onRetry={() => void documents.refetch()}
            />
          )}
          {!documents.isPending && !documents.isError && rows.length === 0 && (
            <StatusPanel title="Sin documentos">
              <p>Sube recibos o comprobantes para tenerlos junto a tus gastos.</p>
            </StatusPanel>
          )}
          {rows.length > 0 && (
            <ul className="document-list">
              {rows.map((document_) => (
                <DocumentRow
                  key={document_.id}
                  document_={document_}
                  groupName={document_.groupId ? groupNames.get(document_.groupId) : undefined}
                />
              ))}
            </ul>
          )}
          {documents.hasNextPage && (
            <Button
              variant="tertiary"
              type="button"
              isDisabled={documents.isFetchingNextPage}
              onPress={() => void documents.fetchNextPage()}
            >
              {documents.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
            </Button>
          )}
        </div>
        <UploadForm groups={groups.data ?? []} />
      </div>
    </PageHeader>
  );
}
