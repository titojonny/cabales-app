import { Button } from '@heroui/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { HttpError } from '../api/http';
import { downloadBlob, filenameFromContentDisposition } from '../api/download';
import { moduleKeys } from '../api/module-queries';
import { DOCUMENT_CATEGORIES, type Document, type OcrJob } from '../api/module-schemas';
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

function proposalAmount(
  cents: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (cents == null) return 'No detectado';
  return currency
    ? formatMoney(cents, currency)
    : `${(cents / 100).toFixed(2)} · moneda no detectada`;
}

/** Descarga por la API autenticada; el archivo llega como adjunto. */
async function download(document_: Document) {
  const response = await modulesApi.downloadDocument(document_.id);
  downloadBlob(response.blob, filenameFromContentDisposition(response.headers.get('Content-Disposition'), document_.name));
}

/** Abre una copia temporal recibida desde la API; nunca conserva una URL de almacenamiento. */
async function view(document_: Document) {
  const response = await modulesApi.downloadDocument(document_.id);
  const url = URL.createObjectURL(response.blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function UploadForm({ groups }: { groups: Array<{ id: string; name: string }> }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [groupId, setGroupId] = useState('');
  const [category, setCategory] = useState<(typeof DOCUMENT_CATEGORIES)[number]>('OTRO');
  const [expiresAt, setExpiresAt] = useState('');
  const [noticeDays, setNoticeDays] = useState('30,7');
  const [error, setError] = useState<string>();
  const upload = useMutation({
    mutationFn: () => {
      const parsedNoticeDays = noticeDays
        .split(',')
        .map((value) => Number(value.trim()));
      return modulesApi.uploadDocument(file!, {
        ...(groupId ? { groupId } : {}),
        category,
        ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59.000Z`).toISOString() } : {}),
        expiryNoticeDays: parsedNoticeDays,
      });
    },
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
    const parsedNoticeDays = noticeDays
      .split(',')
      .map((value) => Number(value.trim()));
    if (
      parsedNoticeDays.length < 1 ||
      parsedNoticeDays.length > 3 ||
      parsedNoticeDays.some((value) => !Number.isInteger(value) || value < 1 || value > 365) ||
      new Set(parsedNoticeDays).size !== parsedNoticeDays.length
    )
      return setError('Los avisos deben ser de 1 a 3 días, entre 1 y 365, sin repetir.');
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
        <label htmlFor="document-category">Categoría</label>
        <select id="document-category" value={category} onChange={(event) => setCategory(event.target.value as (typeof DOCUMENT_CATEGORIES)[number])}>
          {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label htmlFor="document-expires">Vencimiento (opcional)</label>
        <input id="document-expires" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        <label htmlFor="document-notice-days">Avisos previos en días (separados por coma)</label>
        <input
          id="document-notice-days"
          inputMode="numeric"
          pattern="\d{1,3}(,\d{1,3}){0,2}"
          value={noticeDays}
          onChange={(event) => setNoticeDays(event.target.value)}
          aria-describedby="document-notice-days-help"
        />
        <p id="document-notice-days-help" className="muted small">
          Entre 1 y 3 valores de 1 a 365; por defecto 30,7.
        </p>
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

function OcrExpenseLauncher({ job }: { job: OcrJob }) {
  const groups = useQuery(queries.groups());
  const [groupId, setGroupId] = useState('');
  const [eventId, setEventId] = useState('');
  const events = useQuery({ ...queries.events(groupId), enabled: Boolean(groupId) });
  useEffect(() => {
    if (!groupId && groups.data?.length === 1) setGroupId(groups.data[0]!.id);
  }, [groupId, groups.data]);
  useEffect(() => {
    if (events.data && !events.data.some((event) => event.id === eventId)) setEventId('');
  }, [eventId, events.data]);
  const href =
    groupId && eventId
      ? `/app/groups/${groupId}/events/${eventId}/expenses/new?ocrJobId=${encodeURIComponent(job.id)}`
      : '#';
  return (
    <div className="ocr-create-expense">
      <strong>Crear gasto con este ticket</strong>
      <p className="muted small">
        Elige el grupo y el evento. El formulario abrirá los datos editables del escaneo.
      </p>
      <div className="field-pair">
        <div>
          <label htmlFor={`ocr-group-${job.id}`}>Grupo</label>
          <select
            id={`ocr-group-${job.id}`}
            value={groupId}
            onChange={(event) => {
              setGroupId(event.target.value);
              setEventId('');
            }}
          >
            <option value="">Selecciona un grupo</option>
            {(groups.data ?? []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`ocr-event-${job.id}`}>Evento</label>
          <select
            id={`ocr-event-${job.id}`}
            value={eventId}
            disabled={!groupId || events.isPending}
            onChange={(event) => setEventId(event.target.value)}
          >
            <option value="">Selecciona un evento</option>
            {(events.data ?? [])
              .filter((event) => event.status === 'OPEN' && !event.settlement)
              .map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <Link
        className={`button primary ${!eventId ? 'is-disabled' : ''}`}
        aria-disabled={!eventId}
        to={href}
        onClick={(event) => {
          if (!eventId) event.preventDefault();
        }}
      >
        Abrir gasto editable
      </Link>
    </div>
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
                  <dd>{latest.proposal.merchant || 'No detectado'}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>
                    {latest.proposal.totalCents != null && latest.proposal.currency
                      ? formatMoney(latest.proposal.totalCents, latest.proposal.currency)
                      : 'No detectado'}
                  </dd>
                </div>
                <div>
                  <dt>Moneda</dt>
                  <dd>{latest.proposal.currency || 'No detectada'}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>
                    {latest.proposal.occurredAt
                      ? formatDate(latest.proposal.occurredAt)
                      : 'No detectado'}
                  </dd>
                </div>
                <div>
                  <dt>Confianza</dt>
                  <dd>
                    {latest.proposal.confidence == null
                      ? 'No disponible'
                      : `${Math.round(latest.proposal.confidence * 100)} %`}
                  </dd>
                </div>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{proposalAmount(latest.proposal.subtotalCents, latest.proposal.currency)}</dd>
                </div>
                <div>
                  <dt>Impuesto</dt>
                  <dd>{proposalAmount(latest.proposal.taxCents, latest.proposal.currency)}</dd>
                </div>
                <div>
                  <dt>Propina</dt>
                  <dd>{proposalAmount(latest.proposal.tipCents, latest.proposal.currency)}</dd>
                </div>
                <div>
                  <dt>Items detectados</dt>
                  <dd>
                    {latest.proposal.items.length
                      ? latest.proposal.items
                          .map(
                            (item) =>
                              `${item.name} × ${item.quantity ?? 1}: ${proposalAmount(item.amountCents, latest.proposal?.currency)}`,
                          )
                          .join(' · ')
                      : 'No detectados'}
                  </dd>
                </div>
              </dl>
              {!latest.confirmedAt && <OcrExpenseLauncher job={latest} />}
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
                  Es un documento privado; podrás enlazarlo al gasto que crees desde este ticket.
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

function SharedLinksPanel({ document_ }: { document_: Document }) {
  const queryClient = useQueryClient();
  const links = useQuery({
    queryKey: moduleKeys.documentSharedLinks(document_.id),
    queryFn: () => modulesApi.documentSharedLinks(document_.id),
  });
  const [days, setDays] = useState('7');
  const [maxAccesses, setMaxAccesses] = useState('');
  const [createdUrl, setCreatedUrl] = useState('');
  const create = useMutation({
    mutationFn: () =>
      modulesApi.createDocumentSharedLink(document_.id, {
        expiresAt: new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString(),
        ...(maxAccesses ? { maxAccesses: Number(maxAccesses) } : {}),
      }),
    onSuccess: (link) => {
      setCreatedUrl(link.url ?? '');
      void queryClient.invalidateQueries({ queryKey: moduleKeys.documentSharedLinks(document_.id) });
    },
  });
  const revoke = useMutation({
    mutationFn: (linkId: string) => modulesApi.revokeDocumentSharedLink(document_.id, linkId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: moduleKeys.documentSharedLinks(document_.id) }),
  });
  return (
    <section className="shared-links" aria-label={`Enlaces compartidos de ${document_.name}`}>
      <h3>Enlace de solo lectura</h3>
      <div className="field-pair">
        <label htmlFor={`share-days-${document_.id}`}>Caduca en días (máx. 30)</label>
        <input id={`share-days-${document_.id}`} type="number" min={1} max={30} value={days} onChange={(event) => setDays(event.target.value)} />
        <label htmlFor={`share-limit-${document_.id}`}>Límite de accesos (opcional)</label>
        <input id={`share-limit-${document_.id}`} type="number" min={1} max={10000} value={maxAccesses} onChange={(event) => setMaxAccesses(event.target.value)} />
      </div>
      <Button variant="tertiary" size="sm" type="button" isDisabled={create.isPending} onPress={() => create.mutate()}>
        {create.isPending ? 'Creando…' : 'Crear enlace'}
      </Button>
      {createdUrl && <div className="inline-entry"><input aria-label="Enlace creado" readOnly value={createdUrl} /><Button variant="tertiary" size="sm" type="button" onPress={() => void navigator.clipboard?.writeText(createdUrl)}>Copiar</Button></div>}
      {links.data?.map((link) => (
        <div className="inline-entry" key={link.id}>
          <span className="muted small">Vence {formatDate(link.expiresAt)} · {link.accessCount}{link.maxAccesses ? `/${link.maxAccesses}` : ''} accesos</span>
          {!link.revokedAt && <Button variant="danger-soft" size="sm" type="button" onPress={() => revoke.mutate(link.id)}>Revocar</Button>}
        </div>
      ))}
      {create.isError && <ErrorMessage error={create.error} />}
    </section>
  );
}

function DocumentExpiryEditor({ document_ }: { document_: Document }) {
  const queryClient = useQueryClient();
  const [expiresAt, setExpiresAt] = useState(document_.expiresAt?.slice(0, 10) ?? '');
  const [noticeDays, setNoticeDays] = useState(document_.expiryNoticeDays.join(','));
  const save = useMutation({
    mutationFn: () => {
      const parsedNoticeDays = noticeDays.split(',').map((value) => Number(value.trim()));
      if (
        parsedNoticeDays.length < 1 ||
        parsedNoticeDays.length > 3 ||
        parsedNoticeDays.some((value) => !Number.isInteger(value) || value < 1 || value > 365) ||
        new Set(parsedNoticeDays).size !== parsedNoticeDays.length
      )
        throw new Error('Los avisos deben ser de 1 a 3 días, entre 1 y 365, sin repetir.');
      return modulesApi.updateDocument(document_.id, {
        expiresAt: expiresAt
          ? new Date(`${expiresAt}T23:59:59.000Z`).toISOString()
          : null,
        expiryNoticeDays: parsedNoticeDays,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: moduleKeys.documentsRoot }),
  });
  return (
    <form
      className="document-expiry-editor"
      aria-label={`Vencimiento de ${document_.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <label htmlFor={`expiry-${document_.id}`}>Fecha de vencimiento</label>
      <input
        id={`expiry-${document_.id}`}
        type="date"
        value={expiresAt}
        onChange={(event) => setExpiresAt(event.target.value)}
      />
      <label htmlFor={`expiry-notices-${document_.id}`}>Avisos previos (días)</label>
      <input
        id={`expiry-notices-${document_.id}`}
        inputMode="numeric"
        value={noticeDays}
        onChange={(event) => setNoticeDays(event.target.value)}
      />
      <Button variant="tertiary" size="sm" type="submit" isDisabled={save.isPending}>
        {save.isPending ? 'Guardando…' : 'Guardar vencimiento'}
      </Button>
      {save.isError && <ErrorMessage error={save.error} />}
    </form>
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
  const pin = useMutation({
    mutationFn: () => (document_.isPinned ? modulesApi.unpinDocument(document_.id) : modulesApi.pinDocument(document_.id)),
    onSuccess: refresh,
  });
  const canEdit = document_.access !== 'VIEW';
  const error = downloadMutation.error ?? viewMutation.error ?? rename.error ?? remove.error ?? pin.error;
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
            {accessLabel[document_.access]} · {document_.category}
            {document_.expiresAt
              ? ` · vence ${formatDate(document_.expiresAt)} · avisos ${document_.expiryNoticeDays.join(', ')} días antes`
              : ''}
            {document_.isLegacy ? ' · legacy sin cifrar' : ''}
          </small>
        </span>
      </div>
      <div className="row-actions">
        <Button variant="tertiary" size="sm" type="button" isDisabled={pin.isPending} onPress={() => pin.mutate()} aria-label={`${document_.isPinned ? 'Desfijar' : 'Fijar'} ${document_.name}`}>
          {document_.isPinned ? 'Fijado' : 'Fijar'}
        </Button>
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
      {Boolean(error) && <ErrorMessage error={error} />}
      {expanded && <OcrPanel document_={document_} />}
      {canEdit && expanded && <DocumentExpiryEditor document_={document_} />}
      {document_.access === 'MANAGE' && expanded && <SharedLinksPanel document_={document_} />}
    </li>
  );
}

function DocumentUnlockPanel({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<unknown>();
  const unlock = useMutation({
    mutationFn: () => modulesApi.unlockDocumentsWithPin(pin),
    onSuccess: onUnlocked,
    onError: setError,
  });
  const passkey = useMutation({
    mutationFn: async () => {
      const options = await modulesApi.webAuthnAuthenticationOptions();
      const response = await startAuthentication({ optionsJSON: options as never });
      return modulesApi.webAuthnAuthenticationVerify(response as unknown as Record<string, unknown>);
    },
    onSuccess: onUnlocked,
    onError: setError,
  });
  const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  return (
    <section className="form-card glass-panel" aria-labelledby="docs-unlock-title">
      <h2 id="docs-unlock-title">Desbloquea Docs</h2>
      <p className="muted small">El módulo está protegido. El desbloqueo se conserva solo durante unos minutos en esta sesión.</p>
      <form onSubmit={(event) => { event.preventDefault(); setError(undefined); unlock.mutate(); }} noValidate>
        <label htmlFor="docs-pin">PIN de Docs</label>
        <input id="docs-pin" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={12} value={pin} onChange={(event) => setPin(event.target.value)} />
        <Button variant="primary" type="submit" isDisabled={unlock.isPending || pin.length < 6}>Desbloquear con PIN</Button>
      </form>
      {supported && (
        <Button variant="tertiary" type="button" isDisabled={passkey.isPending} onPress={() => { setError(undefined); passkey.mutate(); }}>
          {passkey.isPending ? 'Esperando passkey…' : 'Usar passkey o biometría'}
        </Button>
      )}
      {!supported && <p className="muted small">Este navegador no admite passkeys; usa el PIN.</p>}
      {Boolean(error) && <ErrorMessage error={error} />}
    </section>
  );
}

/** Documentos privados y compartidos con grupos, descarga autorizada y lectura asistida. */
export function DocsPage() {
  const groups = useQuery(queries.groups());
  const queryClient = useQueryClient();
  const lock = useQuery({ queryKey: ['documents', 'lock'], queryFn: modulesApi.documentLockStatus, retry: false });
  const [groupId, setGroupId] = useState('');
  const [category, setCategory] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'pinned' | 'recent'>('all');
  const filters = {
    ...(groupId ? { groupId } : {}),
    ...(category ? { category } : {}),
    ...(quickFilter === 'pinned' ? { pinned: true } : {}),
    ...(quickFilter === 'recent' ? { recent: true } : {}),
  };
  const locked = Boolean(lock.data?.enabled && !lock.data.unlockedUntil);
  const documents = useInfiniteQuery({
    queryKey: moduleKeys.documents(filters),
    queryFn: ({ pageParam }) => modulesApi.documents({ ...filters, cursor: pageParam }),
    enabled: !locked,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const groupNames = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const rows = documents.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <PageHeader eyebrow="Docs" title="Comprobantes y documentos">
      {locked && <DocumentUnlockPanel onUnlocked={() => void queryClient.invalidateQueries({ queryKey: ['documents', 'lock'] })} />}
      {!locked && <div className="split-layout">
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
            <label htmlFor="docs-category" className="sr-only">Filtrar por categoría</label>
            <select id="docs-category" value={category} onChange={(event) => setCategory(event.target.value)} disabled={locked}>
              <option value="">Todas las categorías</option>
              {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="button-row" role="group" aria-label="Accesos rápidos">
              {(['all', 'pinned', 'recent'] as const).map((item) => <Button key={item} variant={quickFilter === item ? 'primary' : 'tertiary'} size="sm" type="button" onPress={() => setQuickFilter(item)}>{item === 'all' ? 'Todos' : item === 'pinned' ? 'Fijados' : 'Recientes'}</Button>)}
            </div>
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
      </div>}
    </PageHeader>
  );
}

/** Vista pública mínima: nombre y descarga; nunca muestra identidad o grupo. */
export function SharedDocumentPage() {
  const { token = '' } = useParams();
  const document_ = useQuery({
    queryKey: ['shared-document', token],
    queryFn: () => modulesApi.sharedDocument(token),
    enabled: Boolean(token),
    retry: false,
  });
  const download = useMutation({
    mutationFn: async () => {
      const response = await modulesApi.downloadSharedDocument(token);
      downloadBlob(response.blob, filenameFromContentDisposition(response.headers.get('Content-Disposition'), document_.data?.name ?? 'documento'));
    },
  });
  if (document_.isPending) return <LoadingState title="Cargando enlace" />;
  if (document_.isError || !document_.data) return <StatusPanel title="Enlace no disponible"><p>El enlace caducó, fue revocado o alcanzó su límite de accesos.</p></StatusPanel>;
  return (
    <main className="page-shell">
      <section className="form-card glass-panel" aria-labelledby="shared-document-title">
        <h1 id="shared-document-title">Documento compartido</h1>
        <p><strong>{document_.data.name}</strong></p>
        <Button variant="primary" type="button" isDisabled={download.isPending} onPress={() => download.mutate()}>{download.isPending ? 'Descargando…' : 'Descargar'}</Button>
        {download.isError && <ErrorMessage error={download.error} />}
      </section>
    </main>
  );
}
