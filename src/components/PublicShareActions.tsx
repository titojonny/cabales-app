import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cabalesApi } from '../api/cabales-api';
import type { PublicShareLink } from '../api/contracts';
import { ErrorMessage } from './ui';

/** Genera y revoca enlaces de resumen sin persistir el token claro en la app. */
export function PublicShareActions({
  groupId,
  target,
  canManage,
}: {
  groupId: string;
  target: { eventId?: string; settlementId?: string };
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [created, setCreated] = useState<PublicShareLink | null>(null);
  const links = useQuery({
    queryKey: ['public-share-links', groupId],
    queryFn: () => cabalesApi.publicShareLinks(groupId),
    enabled: canManage,
  });
  const create = useMutation({
    mutationFn: () => cabalesApi.createPublicShareLink(groupId, { ...target, expiresInDays: days }),
    onSuccess: (link) => {
      setCreated(link);
      void queryClient.invalidateQueries({ queryKey: ['public-share-links', groupId] });
    },
  });
  const revoke = useMutation({
    mutationFn: (linkId: string) => cabalesApi.revokePublicShareLink(groupId, linkId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['public-share-links', groupId] }),
  });
  if (!canManage) return null;
  const targetLinks = (links.data ?? []).filter((link) =>
    target.eventId ? link.eventId === target.eventId : link.settlementId === target.settlementId,
  );
  return (
    <section className="members-card glass-panel" aria-labelledby="public-share-title">
      <h2 id="public-share-title">Compartir resumen</h2>
      <p className="muted">
        Solo lectura, sin correos ni datos sensibles. El enlace caduca como máximo en 30 días.
      </p>
      <div className="inline-entry">
        <label htmlFor="share-expiry">Caduca en días</label>
        <input
          id="share-expiry"
          type="number"
          min={1}
          max={30}
          value={days}
          onChange={(event) => setDays(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
        />
        <Button
          variant="primary"
          type="button"
          isDisabled={create.isPending}
          onPress={() => create.mutate()}
        >
          {create.isPending ? 'Generando…' : 'Generar enlace'}
        </Button>
      </div>
      {created?.url && (
        <div className="invitation-result" role="status">
          <label htmlFor="public-share-url">Enlace público</label>
          <input id="public-share-url" readOnly value={created.url} />
          <Button
            variant="tertiary"
            type="button"
            onPress={() => void navigator.clipboard?.writeText(created.url ?? '')}
          >
            Copiar enlace
          </Button>
        </div>
      )}
      {create.isError && <ErrorMessage error={create.error} />}
      {revoke.isError && <ErrorMessage error={revoke.error} />}
      {targetLinks.length > 0 && (
        <ul className="share-link-list">
          {targetLinks.map((link) => (
            <li key={link.id}>
              <span>
                {link.revokedAt
                  ? 'Revocado'
                  : `Válido hasta ${new Date(link.expiresAt).toLocaleDateString('es')}`}
              </span>
              {!link.revokedAt && (
                <Button
                  variant="danger-soft"
                  size="sm"
                  type="button"
                  isDisabled={revoke.isPending}
                  onPress={() => revoke.mutate(link.id)}
                >
                  Revocar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
