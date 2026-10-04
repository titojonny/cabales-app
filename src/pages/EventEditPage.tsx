import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cabalesApi } from '../api/cabales-api';
import { queries, queryKeys } from '../api/queries';
import { eventEditSchema, type EventEditValues } from '../domain/validation';
import { ErrorMessage, FieldError, StatusPanel } from '../components/ui';
import { PageHeader } from './GroupPages';

/** Formulario de edición autorizado por la API para datos no financieros del evento. */
export function EventEditPage() {
  const { groupId = '', eventId = '' } = useParams();
  const event = useQuery(queries.event(groupId, eventId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [linkDraft, setLinkDraft] = useState({ label: '', url: '' });
  const form = useForm<EventEditValues>({
    resolver: zodResolver(eventEditSchema),
    defaultValues: {
      name: '',
      description: '',
      startsAt: '',
      endsAt: '',
      locationName: '',
      locationAddress: '',
      mapsUrl: '',
      timeZone: '',
      links: [],
    },
  });
  const links = form.watch('links');

  useEffect(() => {
    if (!event.data) return;
    form.reset({
      name: event.data.name,
      description: event.data.description ?? '',
      startsAt: toLocalInput(event.data.startsAt),
      endsAt: event.data.endsAt ? toLocalInput(event.data.endsAt) : '',
      locationName: event.data.locationName ?? '',
      locationAddress: event.data.locationAddress ?? '',
      mapsUrl: event.data.mapsUrl ?? '',
      timeZone: event.data.timeZone ?? '',
      links: event.data.links?.map(({ label, url }) => ({ label, url })) ?? [],
    });
  }, [event.data, form]);

  const mutation = useMutation({
    mutationFn: (values: EventEditValues) =>
      cabalesApi.updateEvent(groupId, eventId, {
        name: values.name,
        description: values.description || null,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
        locationName: values.locationName || null,
        locationAddress: values.locationAddress || null,
        mapsUrl: values.mapsUrl || null,
        timeZone: values.timeZone || null,
        links: values.links,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.event(groupId, eventId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(groupId) });
      navigate(`/app/groups/${groupId}/events/${eventId}`);
    },
  });

  if (event.isPending)
    return (
      <StatusPanel title="Cargando edición">
        <p>Consultando los datos actuales…</p>
      </StatusPanel>
    );
  if (event.isError)
    return (
      <StatusPanel title="No pudimos preparar la edición">
        <ErrorMessage error={event.error} />
      </StatusPanel>
    );

  const addLink = () => {
    if (!linkDraft.label.trim() || !linkDraft.url.trim()) return;
    form.setValue('links', [...links, { label: linkDraft.label, url: linkDraft.url }], {
      shouldValidate: true,
    });
    setLinkDraft({ label: '', url: '' });
  };

  return (
    <PageHeader eyebrow="Actividad compartida" title={`Editar ${event.data.name}`}>
      <section className="form-card glass-panel">
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <label htmlFor="edit-event-name">Nombre</label>
          <input id="edit-event-name" {...form.register('name')} />
          <FieldError id="edit-event-name-error" message={form.formState.errors.name?.message} />
          <label htmlFor="edit-starts-at">Fecha y hora de inicio</label>
          <input id="edit-starts-at" type="datetime-local" {...form.register('startsAt')} />
          <FieldError id="edit-starts-at-error" message={form.formState.errors.startsAt?.message} />
          <label htmlFor="edit-ends-at">
            Fecha y hora de fin <span className="optional">Opcional</span>
          </label>
          <input id="edit-ends-at" type="datetime-local" {...form.register('endsAt')} />
          <FieldError id="edit-ends-at-error" message={form.formState.errors.endsAt?.message} />
          <label htmlFor="edit-event-description">Descripción</label>
          <textarea id="edit-event-description" rows={4} {...form.register('description')} />
          <label htmlFor="edit-location-name">Lugar</label>
          <input id="edit-location-name" {...form.register('locationName')} />
          <label htmlFor="edit-location-address">Dirección</label>
          <input id="edit-location-address" {...form.register('locationAddress')} />
          <label htmlFor="edit-maps-url">Enlace de Maps (HTTPS)</label>
          <input id="edit-maps-url" type="url" {...form.register('mapsUrl')} />
          <FieldError id="edit-maps-url-error" message={form.formState.errors.mapsUrl?.message} />
          <label htmlFor="edit-time-zone">
            Zona horaria <span className="optional">Opcional</span>
          </label>
          <input id="edit-time-zone" {...form.register('timeZone')} />
          <fieldset>
            <legend>Enlaces</legend>
            <div className="field-pair">
              <input
                aria-label="Etiqueta del enlace"
                value={linkDraft.label}
                onChange={(change) =>
                  setLinkDraft((current) => ({ ...current, label: change.target.value }))
                }
              />
              <input
                aria-label="URL del enlace"
                type="url"
                value={linkDraft.url}
                onChange={(change) =>
                  setLinkDraft((current) => ({ ...current, url: change.target.value }))
                }
              />
            </div>
            <Button variant="tertiary" type="button" onPress={addLink}>
              Agregar enlace
            </Button>
            <div className="chip-list">
              {links.map((link, index) => (
                <Button
                  key={`${link.url}-${index}`}
                  variant="tertiary"
                  className="status-chip pending"
                  type="button"
                  onPress={() =>
                    form.setValue(
                      'links',
                      links.filter((_, linkIndex) => linkIndex !== index),
                      { shouldValidate: true },
                    )
                  }
                  aria-label={`Quitar enlace ${link.label}`}
                >
                  {link.label} ×
                </Button>
              ))}
            </div>
            <FieldError
              id="edit-links-error"
              message={
                form.formState.errors.links?.message ||
                form.formState.errors.links?.[0]?.url?.message ||
                form.formState.errors.links?.[0]?.label?.message
              }
            />
          </fieldset>
          {mutation.isError && <ErrorMessage error={mutation.error} />}
          <div className="button-row">
            <Button variant="primary" type="submit" isDisabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Link className="button quiet" to={`/app/groups/${groupId}/events/${eventId}`}>
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </PageHeader>
  );
}

function toLocalInput(value: string): string {
  return new Date(value).toISOString().slice(0, 16);
}
