import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cabalesApi } from '../api/cabales-api';
import { useAuth } from '../auth/AuthProvider';
import { ErrorMessage } from './ui';

/** Hilo de texto plano; React renderiza el cuerpo como texto y nunca como HTML. */
export function EventComments({
  groupId,
  eventId,
  canModerate,
}: {
  groupId: string;
  eventId: string;
  canModerate: boolean;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const comments = useQuery({
    queryKey: ['event-comments', groupId, eventId],
    queryFn: () => cabalesApi.eventComments(groupId, eventId),
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['event-comments', groupId, eventId] });
  const create = useMutation({
    mutationFn: () => cabalesApi.createEventComment(groupId, eventId, body),
    onSuccess: () => {
      setBody('');
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: () => cabalesApi.updateEventComment(groupId, eventId, editing ?? '', editBody),
    onSuccess: () => {
      setEditing(null);
      setEditBody('');
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => cabalesApi.deleteEventComment(groupId, eventId, commentId),
    onSuccess: refresh,
  });
  return (
    <section className="members-card glass-panel" aria-labelledby="comments-title">
      <h2 id="comments-title">Comentarios</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (body.trim()) create.mutate();
        }}
      >
        <label htmlFor="event-comment">Añade un comentario</label>
        <textarea
          id="event-comment"
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-describedby="comment-help"
        />
        <small id="comment-help">Texto plano, máximo 2000 caracteres.</small>
        <Button variant="primary" type="submit" isDisabled={create.isPending || !body.trim()}>
          Publicar
        </Button>
      </form>
      {comments.isError && <ErrorMessage error={comments.error} />}
      {create.isError && <ErrorMessage error={create.error} />}
      {update.isError && <ErrorMessage error={update.error} />}
      {remove.isError && <ErrorMessage error={remove.error} />}
      {comments.data?.length === 0 && <p className="muted">Todavía no hay comentarios.</p>}
      <ol className="comment-list">
        {comments.data?.map((comment) => {
          const own = comment.authorUserId === session?.user.id;
          const canEdit = own || canModerate;
          return (
            <li key={comment.id} className="comment-row">
              <div className="comment-meta">
                <strong>{comment.author.displayName}</strong>
                <time dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleString('es')}
                </time>
              </div>
              {editing === comment.id ? (
                <div>
                  <textarea
                    aria-label="Editar comentario"
                    rows={3}
                    maxLength={2000}
                    value={editBody}
                    onChange={(event) => setEditBody(event.target.value)}
                  />
                  <div className="button-row">
                    <Button
                      variant="primary"
                      type="button"
                      isDisabled={update.isPending || !editBody.trim()}
                      onPress={() => update.mutate()}
                    >
                      Guardar
                    </Button>
                    <Button variant="tertiary" type="button" onPress={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{comment.body}</p>
              )}
              {editing !== comment.id && canEdit && (
                <div className="button-row">
                  <Button
                    variant="tertiary"
                    size="sm"
                    type="button"
                    onPress={() => {
                      setEditing(comment.id);
                      setEditBody(comment.body);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger-soft"
                    size="sm"
                    type="button"
                    isDisabled={remove.isPending}
                    onPress={() => remove.mutate(comment.id)}
                  >
                    Borrar
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
